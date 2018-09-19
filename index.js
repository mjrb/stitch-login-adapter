#!/path/to/some/nodejs
const stitch=require("mongodb-stitch-server-sdk");
const Stitch=stitch.Stitch;
const ServerApiKeyCredential=stitch.ApiKeyCredential;
const RemoteMongoClient=stitch.RemoteMongoClient;

const express = require("express");
const app=express();
const bodyParser= require("body-parser");
const jwt=require("jsonwebtoken");
const cors=require("cors");
const axios=require("axios");

//parts of this are specific to LCS (the HackRU backend)
//but it can easily be recycled for any login system
//that can be accessed through http. (or potentialy ldap + friends)

//config you need from stich so it can accept your JWTs

const secret="example_secret_that_is_32_long32";
const stitchAppIdmentorq="appid-for-client";
const LCSURL="https://url.for.the.login.server.com";

//config and setup to upload user meta to stitch
//idealy this would already be done by seting stitch_meta
//in the JWTs, but I'm not sure why it wasn't working so
//a partial work around is to add meta to a collection in stitch
//and associate it with a user with a db trigger. the trigger doesn't
//work that well since the user logs in and sees no data because
//there is a delay to change the owner of the meta

const stitchAPIKey="beautifly-long-api-key-that-seems-pretty-safe";
const stitchAppIdMentorQLCS="appid-for-server-to-upload-metadata";

//initialize the client and get a reference to the user meta collections
const client=Stitch.initializeDefaultAppClient(stitchAppIdMentorQLCS);

const lcsDataColl=client.getServiceClient(
    RemoteMongoClient.factory,
    "mongodb-atlas"
).db("mentorq").collection("lcsdata");

app.use(bodyParser.json());
app.use(cors());

//this is the function that checks if logins are valid
//for LCS it returns a promise with an LCS token
const LCSLogin = (username, password) => {
    return axios.post(LCSURL+"/authorize", {
	email: username,
	password: password
    }).then(LCSResponse => {
	const code = LCSResponse.data.statusCode;
	if(code === 403){
	    throw new Error("Bad Username or Password")
	} else if (code !== 200) {
	    throw new Error("LCS Response " + code)
	}
	const responseBody = LCSResponse.data.body;
	const token = JSON.parse(responseBody).auth.token;
	return token;
    })
}

//this is the function that gets use meta and ot also returns a promise
const getLCSData = function(email, token){
    return axios.post(LCSURL+"/read", {
	email: email,
	token: token,
	//looking for a user document with our email will give
	//us the entire user's document
	query: {email: email}
    }).then(response => {
	if (response.data.statusCode !== 200) {
	    throw new Error("Failed to get user data " + code)
	}
	const LCSData=response.data.body[0];
	return {token, LCSData};
    })
}

//this is the only route
app.post("/login", (req, res)=>{
    const email = req.body.email;
    const password = req.body.password;
    if(!email || !password){
	res.status(400).json({
	    message: "must have email and password fields"
	})
	return;
    }
    LCSLogin(email, password)
	.then(token=>getLCSData(email, token))
	.then(stitch_meta => {
	    const token = jwt.sign({
		sub: email,
		aud: stitchAppIdmentorq,
		stitch_meta
	    }, secret, {
		expiresIn: 60*60*12 //12hrs
	    })
	    return Promise.all([
		token,
		lcsDataColl.updateOne(
		    {email},
		    {email, stitch_data},
		    {upsert: true}
		)
	    ]);
	}).then(([token, upsertResult])=>{
	    res.status(200).json({
		validLogin: true,
		token
            });
	}).catch(err => {
            res.status(403).json({
		validLogin: false,
		err: err.message
	    });
	})
});

//we have to make sure we login and have a good client before starting the server
client.auth.loginWithCredential(new stitch.ServerApiKeyCredential(stitchAPIKey))
    .then(user=>{
	app.listen(80, function(){
	    console.log('listening on port 80');
	});
    })
