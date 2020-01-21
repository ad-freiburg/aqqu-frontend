# Aqqu Frontend
This is an intuitive frontend for Aqqu Question Answering which features Question Auto-Completion.

## Run with Docker
Build the docker image and start the container using the following commands:

    docker build -t aqqu_frontend .
    docker run --rm -it -p 8182:80 aqqu_frontend

Within the docker container, simply run

    python3 aqqu_server.py 80
    
to start the server. Alternatively, run `make help` to get additional information.
The frontend can then be accessed on server `<host>` with port `<port>` (i.e. 8182 when using above command) at `http://<host>:<port>`.

Note that the [Aqqu API](https://ad-git.informatik.uni-freiburg.de/ad/aqqu-webserver) and the [QAC API](https://github.com/ad-freiburg/qac) need to be started separately.