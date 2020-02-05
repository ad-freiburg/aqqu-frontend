FROM python:3.8
LABEL maintainer="prange@informatik.uni-freiburg.de"
ENV PYTHONIOENCODING=utf-8

# Install python packages
COPY requirements.txt /home/requirements.txt
RUN pip3 install -r /home/requirements.txt

COPY *.py /home/
COPY templates /home/templates
COPY static /home/static

CMD ["python3", "/home/aqqu_server.py", "80", "-d", "/data/"]

# docker build -t aqqu_frontend .
# docker run --rm -it -p 8182:80 --read-only -v /nfs/students/natalie-prange/wikidata_mappings:/data aqqu_frontend
