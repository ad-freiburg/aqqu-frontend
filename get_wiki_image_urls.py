# Copyright 2020, University of Freiburg
# Author: Natalie Prange <prange@informatik.uni-freiburg.de>


import requests
import logging
import time
import argparse
from urllib import parse
from operator import itemgetter
from collections import defaultdict


# Set up the logger
logging.basicConfig(format='%(asctime)s: %(message)s',
                    datefmt="%H:%M:%S", level=logging.INFO)
logger = logging.getLogger(__name__)


def read_qid_title_list(input_file):
    """Read the QID to Wikipedia page-title from the given input file and
    return the mapping as dictionary.

    Arguments:
    input_file - path to the mappings file
    """
    logger.info("Read wikipedia mapping file %s" % input_file)
    lst = list()
    with open(input_file, "r", encoding="utf8") as file:
        for line in file:
            qid, title, _, _ = line.split("\t")
            lst.append((qid, title))
    return lst


def retrieve_wiki_image_url(batch, img_size=500):
    """Retrieve an image for the given titles using the Wikipedia API

    Arguments:
    batch - mapping from Wikipedia page title to list of QIDs
    """
    # Prepare request
    titles_str = "|".join(batch.keys())
    host = "https://en.wikipedia.org/w/api.php"
    data = {"action": "query", "prop": "pageimages", "titles": titles_str,
            "pithumbsize": img_size, "format": "json", "formatversion": 2,
            "pilicense": "any"}

    # Try to send request to API
    counter = 0
    while True:
        counter += 1
        try:
            response = requests.get(host, params=data)
            break
        except requests.exceptions.RequestException:
            time.sleep(2*counter)
            if counter % 100 == 1:
                logger.warning("Cannot reach host. Trial no %d" % counter)

    # Process server response
    if response:
        response = response.json()
        results = response["query"]["pages"]
        urls = []
        errors = []
        for res in results:
            # Get thumbnail url
            thumbnail = ""
            if "thumbnail" in res:
                thumbnail = res["thumbnail"]["source"]
            # Retrieve QID for result title and add QID + image url to result
            title = res["title"]
            if title in batch:
                for qid in batch[title]:
                    urls.append((qid, thumbnail))
                del batch[title]
            else:
                logger.warning("Result title could not be mapped to query: %s"
                               % title)
                errors.append(title)
        if len(batch) > 0:
            logger.warning("Not all query titles could be mapped to result: %s"
                           % batch.items())
            errors += batch.keys()
        return urls, errors

    return [], []


def write_qid_to_image_mapping(lst, outfile, batch_size=20):
    """For each QID-title pair in the given list, retrieve the Wikipedia image
    url and write the QID to url mapping to the output file.

    Arguments:
    lst - a list containing tuples (QID, title)
    outfile - the output file for the mapping
    """
    error_file_name = outfile[:outfile.rfind(".") + 1] + "err"
    error_file = open(error_file_name, "w", encoding="utf8")
    logger.info("Query Wikipedia API")
    logger.info("Write resulting qid to image url mapping to %s" % outfile)
    with open(outfile, "w", encoding="utf8") as file:
        start = time.time()
        batch = defaultdict(list)
        counter = 0
        for qid, title in lst:
            batch[title].append(qid)

            # If batch is full, retrieve Wikipedia image url for each element
            if len(batch) == batch_size:
                urls, errors = retrieve_wiki_image_url(batch)

                # Log errors in separate error file
                for e in errors:
                    error_file.write("%s\n" % e)

                # Write each QID and url in the batch to the output file
                for q, url in urls:
                    file.write("%s\t%s\n" % (q, url))

                # Reset batch
                batch = defaultdict(list)

            counter += 1
            if counter % 1000 == 0:
                logger.info("Processed %d qids in %fs" %
                            (counter, time.time() - start))

        # Retrieve urls for batch remainder
        if len(batch) > 0:
            urls, errors = retrieve_wiki_image_url(batch)

            # Log errors in separate error file
            for e in errors:
                error_file.write("%s\n" % e)

            # Write each QID and url in the batch to the output file
            for q, url in urls:
                file.write("%s\t%s\n" % (q, url))

    logger.info("Done.")



if __name__ == "__main__":
    default_infile = "/nfs/students/natalie-prange/wikidata_mappings/qid_to_wikipedia_info.tsv"
    parser = argparse.ArgumentParser()
    parser.add_argument("output",
                        help="File to which to write the results.")
    parser.add_argument("-i", "--input", default=default_infile,
                        help="QID to (title, image, abstract) mapping file.")

    args = parser.parse_args()
    infile = args.input
    outfile = args.output

    qid_title_list = read_qid_title_list(infile)
    write_qid_to_image_mapping(qid_title_list, outfile)
