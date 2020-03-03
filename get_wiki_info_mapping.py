# Copyright 2020, University of Freiburg
# Author: Natalie Prange <prange@informatik.uni-freiburg.de>


import re
import logging
import argparse
from urllib import parse


# Set up the logger
logging.basicConfig(format='%(asctime)s: %(message)s',
                    datefmt="%H:%M:%S", level=logging.INFO)
logger = logging.getLogger(__name__)


def get_mapping_tuples(input_file, max_splits=-1):
    """Reads the input file and yields each line as a tuple of the
    tab-separated values.

    Arguments:
    input_file - the path to the input file
    max_splits - maximum number of splits at tab
    """
    with open(input_file, "r", encoding="utf8") as file:
        for line in file:
            yield line.strip("\n").split("\t", max_splits)


def get_qid_from_url(url):
    """Get the QID from a Wikidata entity url.

    Arguments:
    url - the QID url
    """
    return re.sub(r"<http://www.wikidata.org/entity/(Q[0-9]+)>", r"\1", url)


def get_wikititle_from_url(url):
    """Get the Wikipedia page title from a Wikipedia url.

    Arguments:
    url - the Wikipedia page url
    """
    title = re.sub(r"<https://en\.wikipedia\.org/wiki/(.*?)>", r"\1", url)
    title = parse.unquote(title)
    title = title.replace("_", " ")
    return title


def clean_abstract_string(abstract):
    """Returns a string cleaned of initiial '"@ ' and trailing ' @"@en'.
    ' @ ' within the string are replaced by ' '.
    '\"' within the string are replaced by '"'
    tab is replaced by ' '

    Arguments:
    abstract - the abstract string
    """
    abstract = re.sub(r'^"@ ', '', abstract)
    abstract = abstract.replace('"@en', "")
    abstract = abstract.replace('@', '')
    abstract = re.sub(r' ( )+', ' ', abstract)
    abstract = abstract.replace('\\"', '"')
    abstract = abstract.replace('\t', ' ')
    return abstract


def get_qid_to_wikititle_dict(input_file):
    """Returns a mapping from QIDs to Wikipedia titles as given in the input
    file. QID-urls are replaced by <QID>, title-urls by <title>.

    Arguments:
    input_file - the path to the input file
    """
    logger.info("Building qid-to-title mapping from file %s" % input_file)
    qid_to_wikititle = dict()
    for qid_url, wiki_url in get_mapping_tuples(input_file):
        qid = get_qid_from_url(qid_url)
        wikiname = get_wikititle_from_url(wiki_url)
        qid_to_wikititle[qid] = wikiname
    return qid_to_wikititle


def get_qid_to_image_dict(input_file):
    """Returns a mapping from QIDs to Wikidata images as given in the input
    file. QID-urls are replaced by <QID>.

    Arguments:
    input_file - the path to the input file
    """    
    logger.info("Building qid-to-image mapping from file %s" % input_file)
    qid_to_image = dict()
    for qid_url, image_url in get_mapping_tuples(input_file):
        qid = get_qid_from_url(qid_url)
        image_url = image_url.strip("<>")
        # Image file may contain several images per QID (via property P18,
        # P109, P14, ...) --> only take the first one
        if qid not in qid_to_image:
            qid_to_image[qid] = image_url
    return qid_to_image


def get_qid_to_abstract_dict(input_file):
    """Returns a mapping from QIDs to Wikipedia abstract as given in the input
    file. QID-urls are replaced by <QID>.

    Arguments:
    input_file - the path to the input file
    """
    logger.info("Building qid-to-abstract mapping from file %s" % input_file)
    qid_to_abstract = dict()
    for qid_url, abstract in get_mapping_tuples(input_file, 1):
        qid = get_qid_from_url(qid_url)
        abstract = clean_abstract_string(abstract)
        qid_to_abstract[qid] = abstract
    return qid_to_abstract


def get_qid_to_wiki_info_dict(qid_to_wikititle, qid_to_image, qid_to_abstract):
    """Combine the three mappings to a single mapping from QID to a tuple
    (<title>, <image>, <abstract>).

    Arguments:
    qid_to_wikititle - mapping from QID to Wikipedia title
    qid_to_image - mapping from QID to Wikidata image
    qid_to_abstract - mapping from QID to Wikipedia abstract
    """
    logger.info("Combining mappings to qid-to-wiki-info mapping.")
    mapping = dict()
    for qid, title in qid_to_wikititle.items():
        image = qid_to_image.get(qid, "")
        abstract = qid_to_abstract.get(qid, "")
        mapping[qid] = (title, image, abstract)
        qid_to_image.pop(qid, None)
        qid_to_abstract.pop(qid, None)
    for qid, image in qid_to_image.items():
        abstract = qid_to_abstract.get(qid, "")
        mapping[qid] = ("", image, abstract)
        qid_to_abstract.pop(qid, None)
    for qid, abstract in qid_to_abstract.items():
        mapping[qid] = ("", "", abstract)
    return mapping


def write_qid_to_wiki_info(output_file, qid_to_wiki_info):
    """Write the mapping from QID to title, image and abstract to the given
    file.

    Arguments:
    output_file - path to the output file
    qid_to_wiki_info - mapping from QID to (<title>, <image>, <abstract>) tuple
    """
    logger.info("Writing qid-to-wiki-info mapping to file %s" % output_file)
    with open(output_file, "w", encoding="utf8") as outfile:
        for qid, tupl in qid_to_wiki_info.items():
            title, image, abstract = tupl
            outfile.write("%s\t%s\t%s\t%s\n" % (qid, title, image, abstract))


def combine_mappings(mapping1, mapping2):
    """Combine two mappings into one. First mapping is preferred.

    Arguments:
    infile1 - file name of the preferred mapping file
    mapping2 - second mapping (Wikidata images)
    """
    logger.info("Combine two mappings to one.")
    for key, val in mapping2.items():
        if val and (key not in mapping1 or not mapping1[key]):
            mapping1[key] = val
    return mapping1


if __name__ == "__main__":
    default_output = "/nfs/students/natalie-prange/wikidata_mappings/qid_to_wikipedia_info.tsv"
    default_title_file = "/nfs/students/natalie-prange/wikidata_mappings/qid_to_title.tsv"
    default_abstract_file = "/nfs/students/natalie-prange/wikidata_mappings/qid_to_abstract.tsv"
    default_image_file = "/nfs/students/natalie-prange/wikidata_mappings/qid_to_image.tsv"

    parser = argparse.ArgumentParser()
    parser.add_argument("-c", "--combine",
                        help="QID to Wikipedia image mapping file with which"
                             " to combine the Wikidata image file.")
    parser.add_argument("-o", "--output-file", default=default_output,
                        help="File to which to write the resulting mapping.")
    parser.add_argument("-t", "--title-file", default=default_title_file,
                        help="File that contains the qid-to-title mapping.")
    parser.add_argument("-a", "--abstract-file", default=default_abstract_file,
                        help="File that contains the qid-to-abstract mapping.")
    parser.add_argument("-i", "--image-file", default=default_image_file,
                        help="File that contains the qid-to-image mapping.")

    args = parser.parse_args()
    combine = args.combine
    output = args.output_file
    title_file = args.title_file
    abstract_file = args.abstract_file
    image_file = args.image_file

    wikititle_dict = get_qid_to_wikititle_dict(title_file)
    image_dict = get_qid_to_image_dict(image_file)

    # Combine two QID to image mappings into one if option was specified
    if combine:
        wikipedia_image_mapping = dict()
        for qid, img_url in get_mapping_tuples(combine):
            wikipedia_image_mapping[qid] = img_url
        image_dict = combine_mappings(wikipedia_image_mapping, image_dict)

    abstract_dict = get_qid_to_abstract_dict(abstract_file)
    wiki_info_dict = get_qid_to_wiki_info_dict(wikititle_dict, image_dict, abstract_dict)
    write_qid_to_wiki_info(output, wiki_info_dict)
