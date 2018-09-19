#!/home/ubuntu/.nvm/versions/node/v10.10.0/bin/node
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

const secret="example_secret_that_is_32_long32";
const stitchAppIdmentorq="appid-for-client";
const LCSURL="https://url.for.the.login.server.com";

const stitchAPIKey="VBz7bM4IvAWSjVR6OswX9t2ZovxWGwgLGN0WffIUy7NGjcERWWk0FYzC8m8ZBkXe";
const stitchAppIdMentorQLCS="appid-for-server-to-upload-metadata";

const client=Stitch.initializeDefaultAppClient(stitchAppIdMentorQLCS);

const lcsDataColl=client.getServiceClient(
    RemoteMongoClient.factory,
    "mongodb-atlas"
).db("mentorq").collection("lcsdata");

app.use(bodyParser.json());
app.use(cors());

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
		expiresIn: 60*60*12
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

client.auth.loginWithCredential(new stitch.ServerApiKeyCredential(stitchAPIKey))
    .then(user=>{
	app.listen(80, function(){
	    console.log('listening on port 80');
	});
    })
