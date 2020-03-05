# Aqqu Frontend
This is an intuitive frontend for Aqqu Question Answering which features Question Auto-Completion.

## Run with Docker
Build the docker image and start the server using the following commands:

    docker build -t aqqu_frontend .
    docker run --rm -it -p 8182:80 --read-only -v /nfs/students/natalie-prange/wikidata_mappings:/data aqqu_frontend
   
The frontend can then be accessed on server `<host>` with port `<port>` (i.e. 8182 when using above command) at `http://<host>:<port>`.

Note that the [Aqqu API](https://ad-git.informatik.uni-freiburg.de/ad/aqqu-webserver) and the [QAC API](https://github.com/ad-freiburg/qac) need to be started separately.

## Create the Wikipedia Info mapping
A mapping from QID to Wikipedia title, abstract and image url is needed in order to provide tooltips for entities, as well as linking entities to their Wikipedia page.
This mapping can be found under

    /nfs/students/natalie-prange/wikidata_mappings/qid_to_wikipedia_info.tsv

when using one of our chair's computer systems.
To build the `qid_to_wikipedia_info.tsv` mapping file from scratch, execute the following steps:

* Run the following three SPARQL queries on [QLever](http://qlever.informatik.uni-freiburg.de/Wikidata_Full/) and save the results as tsv files under the given names.

QID to Wikipedia title query. Save as `qid_to_title.tsv`:

    PREFIX wikibase: <http://wikiba.se/ontology#>
    PREFIX schema: <http://schema.org/>
    PREFIX wd: <http://www.wikidata.org/entity/>
    PREFIX wdt: <http://www.wikidata.org/prop/direct/>
    SELECT ?x ?m WHERE {
       ?m schema:about ?x .
       ?m schema:isPartOf <https://en.wikipedia.org/> .
       ?m2 schema:about ?x .
       ?m2 wikibase:sitelinks ?sitelinks .
       FILTER (?sitelinks >= 15)
    } ORDER BY DESC(?sitelinks)

QID to Wikidata image query. Save as `qid_to_image.tsv`:

    PREFIX wikibase: <http://wikiba.se/ontology#>
    PREFIX schema: <http://schema.org/>
    PREFIX wd: <http://www.wikidata.org/entity/>
    PREFIX wdt: <http://www.wikidata.org/prop/direct/>
    SELECT ?x ?image WHERE {
       ?x wdt:P18|wdt:P109|wdt:P14|wdt:P1442|wdt:P154|wdt:P1543|wdt:P158|wdt:P1766|wdt:P1801|wdt:P2096|wdt:P2713|wdt:P2716|wdt:P2910|wdt:P3311|wdt:P3383|wdt:P3451|wdt:P367|wdt:P41|wdt:P4291|wdt:P4640|wdt:P5252|wdt:P5775|wdt:P7407|wdt:P7415|wdt:P94|wdt:P996 ?image .
       ?m2 schema:about ?x .
       ?m2 wikibase:sitelinks ?sitelinks .
       FILTER (?sitelinks >= 15)
    } ORDER BY DESC(?sitelinks)

QID to Wikipedia abstract query. Save as `qid_to_abstract.tsv`:

    PREFIX wikibase: <http://wikiba.se/ontology#>
    PREFIX schema: <http://schema.org/>
    PREFIX wd: <http://www.wikidata.org/entity/>
    PREFIX wdt: <http://www.wikidata.org/prop/direct/>
    SELECT ?x ?abstract WHERE {
       ?m schema:about ?x .
       ?m @en@schema:abstract ?abstract .
       ?m2 schema:about ?x .
       ?m2 wikibase:sitelinks ?sitelinks .
       FILTER (?sitelinks >= 15)
    } ORDER BY DESC(?sitelinks)

* Run `./get_wiki_info_mapping.sh <directory>`

where `<directory>` is the path to the directory in which your `.tsv` files are stored.
Make sure the path has a trailing `/`.
The resulting mapping is saved as `<directory>qid_to_wikipedia_info.tsv`.

* Don't forget to adjust the mapping path in the `aqqu_server.py` script.

### The `get_wiki_info_mapping.sh` script
The script performs the following tasks:

    python3 get_wiki_info_mapping.py -t "${base_path}qid_to_title.tsv" -a "${base_path}qid_to_abstract.tsv" -i "${base_path}qid_to_image.tsv" -o "${base_path}qid_to_wikipedia_info.tsv"

First, a mapping from QID to the tuple `(<title>, <abstract>, <image>)` is created.
The resulting mapping file is used as input for the Python script `get_wiki_image_urls.py`.

    python3 get_wiki_image_urls.py "${base_path}qid_to_wiki_image.tsv" -i "${base_path}qid_to_wikipedia_info.tsv"

This script retrieves image urls for all titles in the file from the [Wikipedia API](https://en.wikipedia.org/w/api.php) and writes a mapping from QID to image url to an output file `<directory>qid_to_wiki_image.tsv`.
This will take roughly 2 hours.
The resulting mapping file is used as input for the script `get_wiki_info_mapping.py`.

    python3 get_wiki_info_mapping.py -t "${base_path}qid_to_title.tsv" -a "${base_path}qid_to_abstract.tsv" -i "${base_path}qid_to_image.tsv"  -c "${base_path}qid_to_wiki_image.tsv" -o "${base_path}qid_to_wikipedia_info.tsv"

This will overwrite the previous QID to `(<title>, <abstract>, <image>)` mapping. `<image>` is now the image url from the Wikipedia API if an url could be retrieved. Otherwise, it is a url retrieved from Wikidata using the corresponding SPARQL query or an empty string if no image exists for the QID.
The resulting mapping is saved as `<directory>qid_to_wikipedia_info.tsv`.
