base_path=$1

python3 get_wiki_info_mapping.py -t "${base_path}qid_to_title.tsv" -a "${base_path}qid_to_abstract.tsv" -i "${base_path}qid_to_image.tsv" -o "${base_path}qid_to_wikipedia_info.tsv"
python3 get_wiki_image_urls.py "${base_path}qid_to_wiki_image.tsv" -i "${base_path}qid_to_wikipedia_info.tsv"
python3 get_wiki_info_mapping.py -t "${base_path}qid_to_title.tsv" -a "${base_path}qid_to_abstract.tsv" -i "${base_path}qid_to_image.tsv"  -c "${base_path}qid_to_wiki_image.tsv" -o "${base_path}qid_to_wikipedia_info.tsv"