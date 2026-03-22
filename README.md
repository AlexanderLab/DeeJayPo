# DeeJayPo
Little bot to play music on my discord servers.

It utilizes Lavalink free nodes, shoukaku and ffmepg to stream audio to discord. When invoked joins the invoker channel and plays the requested song.

You need to have ffmepg installed in the bot folder for it to work correctly. To start the bot just execute bot.js with your discord credentials.

To invite the bot to your server, you must have administrator rights to be able to give it some permissions needed and roles to get to the channels. Here's the link:

https://discord.com/oauth2/authorize?client_id=1476340495809642710&permissions=8&scope=bot%20applications.commands

To request a song type /onegai your_song_query

I'ts able to queue multiple songs but must be requested one at a time.

To get the queue type /queue

To skip a song type /skip

To completely stop the bot type /stop

When it plays the last requested song bot will leave the channel.
