# Copyright 2023 Andrew Chen Wang
# SPDX-License-Identifier: Apache-2.0
FROM alpine/git

RUN apk add rsync

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
