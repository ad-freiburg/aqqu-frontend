FROM ubuntu:18.04
MAINTAINER Natalie Prange <prangen@informatik.uni-freiburg.de>

RUN apt-get update && apt-get install -y make vim python3-pip

COPY bashrc bashrc
COPY Makefile /home/Makefile
COPY requirements.txt /home/requirements.txt
COPY *.py /home/
COPY templates /home/templates
COPY static /home/static

# Set the python encoding
ENV PYTHONIOENCODING=ISO-8859-1

# Install python packages
RUN pip3 install -r /home/requirements.txt

CMD ["/bin/bash", "--rcfile", "bashrc"]

# docker build -t aqqu_frontend .
# docker run --rm -it -p 8182:80 aqqu_frontend
