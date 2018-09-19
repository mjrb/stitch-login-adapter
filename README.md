# stitch-login-adapter

An example of how to do MongoDB Stitch login with things that may not provide JWTs
This particular example uses LCS, the backed for the official Rutgers Hackathon, HackRU.
LCS offers a route to check user credentials and then gives you some kind of token. this sever
will use that to check client credentials and then offer a JWT for you to use with stitch
and also put use metadata in stitch too.

In its current state this application probably requires some fiddling to get it to
do what you want to do, put its probably not that hard to change the login and metadata functions.
don't hesitate to open an issue if you're trying to use this, I'm more than happy to  answer any
questions/fix bugs/accept pull requests.

## note about metadata
its not quite working how I like yet. ideally it would just put the meta in the JWT, but that
didn't seem to work for strange reasons.