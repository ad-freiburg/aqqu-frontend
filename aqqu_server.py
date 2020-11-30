# Copyright 2020, University of Freiburg
# Author: Natalie Prange <prangen@informatik.uni-freiburg.de>


import sys
import re
import logging
import http.client
import socket
import json
import argparse
from urllib import parse
from flask import Flask, render_template, request

# Connection details for the Aqqu API
HOSTNAME_AQQU = "titan.informatik.privat"
PORT_AQQU = 8300
PATH_PREFIX_AQQU = "/?q=%s"

# Connection details for the QAC API
HOSTNAME_QAC = "wolga.informatik.privat"
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
        # Retrieve qids in the question
        qids = request.args.get("qids")
        # Retrieve Wikipedia urls of entities in the question
        urls = []
        for qid in qids.split(","):
            if qid in qid_to_wikipedia_info:
                title, _, _ = qid_to_wikipedia_info[qid]
                urls.append(get_url_from_title(title))
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
                               qids=qids,
                               urls=json.dumps(urls),
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

    # Get the current time stamp
    timestamp = request.args.get("t")

    # Url encode question prefix to send to QAC API
    urlencoded_prefix = parse.quote(question_prefix)

    # Establish connection to QAC API
    conn = http.client.HTTPConnection(HOSTNAME_QAC + ":" + str(PORT_QAC))

    # Forward question prefix to QAC API
    result = []
    try:
        conn.request("GET", PATH_PREFIX_QAC % urlencoded_prefix)
        response = conn.getresponse().read().decode("utf8")
        logger.info("Response: '%s...'" % response[:69])
        result = json.loads(response)

        # Replace entity mentions by their wikipedia page title
        for i, res in enumerate(result["results"]):
            compl = res["completion"]
            qids = res["qids"]
            wikipedia_compl, urls = wikipediafy_qac_result(compl, qids)
            result["results"][i]["wikified_completion"] = wikipedia_compl
            result["results"][i]["urls"] = urls

        # Add received timestamp to the result
        result.update({"timestamp": timestamp})

    except socket.error:
        logger.error("Connection to QAC API could not be established")

    # Close connection to QAC API
    conn.close()

    return json.dumps(result)


@app.route("/tooltip")
def tooltip():
    """Get the Wikipedia information for the given entity.
    """
    qid = request.args.get("qid")
    if qid in qid_to_wikipedia_info:
        title, image, abstract = qid_to_wikipedia_info[qid]
    else:
        title, image, abstract = "", "", ""
    wiki_info = {"image": image, "abstract": abstract}
    return json.dumps(wiki_info)


def replace_entity_mentions(question):
    """Remove entity mentions in the format [<name>] from the given question
    such that only the entity name remains.

    Arguments:
    question - the question string
    """
    return re.sub(r"\[(.*?)\]", r"\1", question)


def get_answers(json_obj):
    """Get answers from the json_object as list of entity names.

    Arguments:
    json_obj - json object returned by the Aqqu API
    """
    candidates = json_obj["candidates"]
    new_candidates = []
    for cand in candidates:
        # Get the names of the answer entities of the candidate
        cand_answers = cand["answers"]
        answers = []
        for ans in cand_answers:
            name = ans["name"]
            mid = ""
            if "mid" in ans:
                mid = ans["mid"]
            url, image, abstract = "", "", ""
            if mid in mid_to_qid:
                qid = mid_to_qid[mid]
                if qid in qid_to_wikipedia_info:
                    title, image, abstract = qid_to_wikipedia_info[qid]
                    url = get_url_from_title(title)
            answer = {"name": name, "url": url, "image": image,
                      "abstract": abstract, "mid": mid}
            answers.append(answer)
        new_candidates.append(answers)
    return new_candidates


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


def wikipediafy_qac_result(completion, qids):
    """Replace the last entity mention in a qac completion by the corresponding
    Wikipedia page title. This way, the user can decide which entity they mean.

    Arguments:
    completion - the completion string returned by the QAC API
    qids - list of qids of entities in the completion returned by the API
    """
    title = ""
    urls = []
    for i, qid in enumerate(qids):
        if qid in qid_to_wikipedia_info:
            title, _, _ = qid_to_wikipedia_info[qid]
            if not title:
                continue
            urls.append(get_url_from_title(title))
            if i == len(qids) - 1:
                completion = re.sub(r"\[[^\[\]]*?\] $", "[" + title + "] ",
                                    completion)
    return completion, urls


def get_wikipedia_mapping(input_file):
    """Read the QID to Wikipedia page-title, image and abstract from the given
    input file and return the mapping as dictionary.

    Arguments:
    input_file - path to the mappings file
    """
    logger.info("Read wikipedia mapping file %s" % input_file)
    mapping = dict()
    with open(input_file, "r", encoding="utf8") as file:
        for line in file:
            qid, title, image, abstract = line.split("\t")
            abstract = abstract.strip()
            qid = qid.lower()
            mapping[qid] = (title, image, abstract)
    return mapping


def get_mid_to_qid_mapping(input_file):
    """Read the MID to QID mapping from the given input file and return the
    mapping as dictionary.

    Arguments:
    input_file - path to the mappings file
    """
    logger.info("Read MID to QID file %s" % input_file)
    mapping = dict()
    with open(input_file, "r", encoding="utf8") as file:
        for line in file:
            mid, qid = line.split("\t")
            qid = qid.strip().lower()
            mapping[mid] = qid
    return mapping


def get_url_from_title(title):
    """Get the Wikipedia page url for an entity with the given title

    Arguments:
    title - title of the entity url encoded, " " replaced by "_"
    """
    title = parse.quote(title).replace(" ", "_")
    return "https://en.wikipedia.org/wiki/" + title


if __name__ == "__main__":
    # Parse command line arguments
    default_path = "/nfs/students/natalie-prange/wikidata_mappings/"
    parser = argparse.ArgumentParser()
    parser.add_argument("port",
                        help="Specify port on which to run the server")
    parser.add_argument("-d", "--data", default=default_path,
                        help="Specify path on which to look for data files")

    args = parser.parse_args()
    port = args.port
    data_path = args.data.rstrip("/") + "/"

    # Load data
    wiki_info_file = data_path + "qid_to_wikipedia_info.tsv"
    qid_to_wikipedia_info = get_wikipedia_mapping(wiki_info_file)
    mid_to_qid_file = data_path + "mid_to_qid15_combined.tsv"
    mid_to_qid = get_mid_to_qid_mapping(mid_to_qid_file)

    app.run(threaded=True, host="::", port=port, debug=False)
