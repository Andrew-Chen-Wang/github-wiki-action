#!/bin/bash

TEMP_CLONE_FOLDER="temp_wiki_4567129308192764578126573891723968"

if [ -z "$ACTION_MAIL" ]; then
  echo "ACTION_MAIL ENV is missing"
  exit 1
fi

if [ -z "$ACTION_NAME" ]; then
  echo "ACTION_NAME ENV is missing"
  exit 1
fi

if [ -z "$REPO" ]; then
  echo "REPO ENV is missing. Use the one from the README"
  exit 1
fi

if [ -z "$WIKI_FOLDER" ]; then
  echo "WIKI_FOLDER ENV is missing, using default wiki"
  MD_FOLDER='wiki'
fi

if [ -z "$WIKI_PUSH_MESSAGE" ]; then
  echo "WIKI_PUSH_MESSAGE ENV is missing, using the commit's"
fi

mkdir $TEMP_CLONE_FOLDER
cd $TEMP_CLONE_FOLDER
git init
git config user.name $ACTION_NAME
git config user.email $ACTION_MAIL
git pull https://${GH_PAT}@github.com/$REPO.wiki.git
cd ..

# Get commit message
message=$(git log -1 --format=%B)

rsync -av $WIKI_FOLDER $TEMP_CLONE_FOLDER/ --exclude $TEMP_CLONE_FOLDER --exclude .git
cd $TEMP_CLONE_FOLDER
git add .
git commit -m "$message"
git push --set-upstream https://${GH_PAT}@github.com/$REPO.wiki.git master
