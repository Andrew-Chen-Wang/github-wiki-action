FROM alpine/git

RUN apk add rsync

COPY LICENSE README.md /
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]