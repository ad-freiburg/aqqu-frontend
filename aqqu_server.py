# Copyright 2020, University of Freiburg
# Author: Natalie Prange <prangen@informatik.uni-freiburg.de>


import sys
import re
import logging
import http.client
import socket
import json
from urllib import parse
from flask import Flask, render_template, request

# Connection details for the Aqqu API
HOSTNAME_AQQU = "titan.informatik.privat"
PORT_AQQU = 8300
PATH_PREFIX_AQQU = "/?q=%s"

# Connection details for the QAC API
HOSTNAME_QAC = "nkaba.informatik.privat"
PORT_QAC = 8181
PATH_PREFIX_QAC = "/?q=%s"

# Set up the logger
logging.basicConfig(format='%(asctime)s : %(message)s', datefmt="%H:%M:%S",
                    level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)


@app.route("/")
def home():
    question = request.args.get("q")
    if question:
        # Replace entity mentions by entity name
        aqqu_question = replace_entity_mentions(question)
        # Url encode question to send it to Aqqu API
        aqqu_question = parse.quote(aqqu_question)

        # Establish connection to Aqqu API
        conn = http.client.HTTPConnection(HOSTNAME_AQQU + ":" + str(PORT_AQQU))

        # Forward question to Aqqu API
        answers = []
        interpretations = []
        error = ""
        try:
            conn.request("GET", PATH_PREFIX_AQQU % aqqu_question)
            response = conn.getresponse().read().decode("utf8")
            logger.info("Response: '%s...'" % response[:69])
            json_obj = json.loads(response)
            interpretations = get_interpretation_strings(json_obj)
            answers = get_answers(json_obj)

            if len(answers) == 0:
                error = "No answers found"

        except socket.error:
            logger.error("Connection to Aqqu API could not be established")
            error = "No connection to Aqqu API"

        # Close connection to Aqqu API
        conn.close()
        
        return render_template("index.html",
                               question=question,
                               interpretations=json.dumps(interpretations),
                               answers=json.dumps(answers),
                               error=error)

    return render_template("index.html")


@app.route("/qac")
def qac():
    """Get completion predictions for the current question prefix.
    """    
    # Get the current question prefix
    question_prefix = request.args.get("q")

    # Url encode question prefix to send to QAC API
    urlencoded_prefix = parse.quote(question_prefix)

    # Establish connection to QAC API
    conn = http.client.HTTPConnection(HOSTNAME_QAC + ":" + str(PORT_QAC))

    # Forward question prefix to QAC API
    completions = []
    try:
        conn.request("GET", PATH_PREFIX_QAC % urlencoded_prefix)
        response = conn.getresponse().read().decode("utf8")
        logger.info("Response: '%s...'" % response[:69])
        json_obj = json.loads(response)
        completions = get_completions(json_obj)
    except socket.error:
        logger.error("Connection to QAC API could not be established")

    # Close connection to QAC Api
    conn.close()

    return json.dumps(completions)


def replace_entity_mentions(question):
    """Remove entity mentions in the format [<type>|<qid>:<name>] from the 
    given question such that only the entity name remains.

    Arguments:
    question - the question string
    """
    return re.sub(r"\[.*?\|.*?:(.*?)\]", r"\1", question)


def get_answers(json_obj):
    """Get answers from the json_object as list of entity names.

    Arguments:
    json_obj - json object returned by the Aqqu API
    """
    candidates = json_obj["candidates"]
    answers = []

    for cand in candidates:
        # Get the names of the answer entities of the candidate
        cand_answers = cand["answers"]
        ent_names = []
        for ans in cand_answers:
            ent_name = ans["name"]
            ent_names.append(ent_name)
        answers.append(ent_names)

    return answers


def get_interpretation_strings(json_obj):
    """Get interpretation strings from the json_object as list of strings.

    Arguments:
    json_obj - json object returned by the Aqqu API
    """
    candidates = json_obj["candidates"]
    interpretation_strs = []
    mid_to_name = get_mid_2_name(json_obj)

    for cand in candidates:
        # Get the mids of the recognized entities in the question
        rec_ents = cand["entity_matches"]
        rec_ents_str = ""
        for i in range(len(rec_ents)):
            mid = rec_ents[i]["mid"]
            name = mid_to_name.get(mid, mid)
            rec_ents_str += name
            if i < len(rec_ents) - 1:
                rec_ents_str += " - "

        # Get the names of the recognized relations in the question
        rec_rels = cand["relation_matches"]
        rec_rels_str = ""
        for i in range(len(rec_rels)):
            single_rel_str = ""
            curr_rels = rec_rels[i]["relations"]
            for j, rel in enumerate(curr_rels):
                # Remove prefixes like film.film_character.<rel_name>
                rel = rel[rel.rfind(".") + 1:]
                # Replace "_" by " "
                single_rel_str += rel.replace("_", " ")
                if j < len(curr_rels) - 1:
                    single_rel_str += " -> "
            rec_rels_str += single_rel_str
            if i < len(rec_rels) - 1:
                rec_rels_str += " - "

        # Create the interpretation string for the candidate
        interpretation_str = rec_ents_str + ", " + rec_rels_str + ":"
        interpretation_strs.append(interpretation_str)

    return interpretation_strs


def get_mid_2_name(json_obj):
    """Get names of identified entities as a mapping from MID to entity name.

    Arguments:
    json_obj - json object returned by the Aqqu API
    """
    mid_to_name = dict()
    identified_entities = json_obj["parsed_query"]["identified_entities"]
    for ent in identified_entities:
        mid = ent["entity"]["mid"]
        name = ent["entity"]["name"]
        mid_to_name[mid] = name
    return mid_to_name


def get_completions(json_obj):
    """Get completion predictions from the json_object as list of completion
    strings.

    Arguments:
    json_obj - json object returned by the QAC API
    """
    completions = json_obj["completions"]
    return [c["completion"] for c in completions]


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python3 %s <port>" % sys.argv[0])
        exit(1)

    port = int(sys.argv[1])

    app.run(threaded=True, host="::", port=port, debug=False)
