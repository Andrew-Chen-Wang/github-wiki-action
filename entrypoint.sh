#!/bin/sh

TEMP_CLONE_FOLDER="temp_wiki_4567129308192764578126573891723968"

if [ -z "$GH_MAIL" ]; then
  echo "GH_MAIL ENV is missing. Use the email for a user that can push to this repository."
  exit 1
fi

if [ -z "$GH_NAME" ]; then
  echo "GH_NAME ENV is missing. Use the username for a user that can push to this repository."
  exit 1
fi

if [ -z "$REPO" ]; then
  echo "REPO ENV is missing. Using the current one."
  REPO=$GITHUB_REPOSITORY
else
  if [ -z "$REPO" != "$GITHUB_REPOSITORY"]; then
    if [ -z "$GITHUB_TOKEN" == "$GH_PAT"]; then
        echo "You must use a Personal Access Token to write to the wiki of a different repository."
        exit 1
    fi
  fi
fi

if [ -z "$WIKI_DIR" ]; then
    echo "WIKI_FOLDER ENV is missing, using default wiki/"
    WIKI_DIR='wiki/'
fi

echo "Configuring wiki git..."
mkdir $TEMP_CLONE_FOLDER
cd $TEMP_CLONE_FOLDER
git init
git config user.name $ACTION_NAME
git config user.email $GH_MAIL
git pull https://${GH_PAT:-"$GITHUB_ACTOR:$GITHUB_TOKEN"}@github.com/$REPO.wiki.git
cd ..

# Get commit message
if [ -z "$WIKI_PUSH_MESSAGE" ]; then
  echo "WIKI_PUSH_MESSAGE ENV is missing, using the commit's."
  message=$(git log -1 --format=%B)
else
  message=$WIKI_PUSH_MESSAGE
fi
echo "Message: $message"

# https://github.com/maxheld83/ghpages/pull/18

echo "Copying files to Wiki"
rsync -av $WIKI_DIR $TEMP_CLONE_FOLDER/ --exclude $TEMP_CLONE_FOLDER --exclude .git --delete
echo "Pushing to Wiki"
cd $TEMP_CLONE_FOLDER
git add .
git commit -m "$message"
git push --set-upstream https://${GH_PAT:-"$GITHUB_ACTOR:$GITHUB_TOKEN"}@github.com/$REPO.wiki.git master
