#!/bin/bash

TEMP_CLONE_FOLDER="temp_wiki_4567129308192764578126573891723968"

if [ -z "$GH_MAIL" ]; then
  echo "ACTION_MAIL ENV is missing"
  exit 1
fi

if [ -z "$GH_NAME" ]; then
  echo "ACTION_NAME ENV is missing"
  exit 1
fi

if [ -z "$REPO" ]; then
  echo "REPO ENV is missing. Use the one from the README"
  REPO=$GITHUB_REPOSITORY
fi

if [ -z "$WIKI_DIR" ]; then
  echo "WIKI_FOLDER ENV is missing, using default wiki"
  WIKI_DIR='wiki'
fi

if [ -z "$WIKI_PUSH_MESSAGE" ]; then
  echo "WIKI_PUSH_MESSAGE ENV is missing, using the commit's."
fi

echo "Configuring..."
mkdir $TEMP_CLONE_FOLDER
cd $TEMP_CLONE_FOLDER
git init
git config user.name $ACTION_NAME
git config user.email $GH_MAIL
git pull https://${GH_PAT}@github.com/$REPO.wiki.git
cd ..

# Get commit message
message=$(git log -1 --format=%B)

echo "Copying files to Wiki"
rsync -av $WIKI_DIR $TEMP_CLONE_FOLDER/ --exclude $TEMP_CLONE_FOLDER --exclude .git
echo "Pushing to Wiki"
cd $TEMP_CLONE_FOLDER
git add .
git commit -m "$message"
git push --set-upstream https://${GH_PAT}@github.com/$REPO.wiki.git master
