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

const secret=process.env.SLA_SECRET || "example_secret_that_is_32_long32";
const stitchAppId=process.env.SLA_APP_ID ||  "appid-for-client";

//route to real login server
const LCSURL=process.env.SLA_UPSTREAM_URL || "https://url.for.the.login.server.com";
const port=process.env.SLA_PORT || 3000;


app.use(bodyParser.json());
app.use(cors());

class BadResponse extends Error {
    constructor(response){
	this.name="BadResponseError "+response.data.code;	
	this.message="unexpected response from LCS "
	    +JSON.stringify(response);
    }
}
class BadLogin extends Error {
    constructor(){
	this.name="BadLogin";
	this.message="Bad Username or Password";
    }
}

//this is the function that checks if logins are valid
//for LCS it returns a promise with an LCS token
const LCSLogin = (username, password) => {
    return axios.post(LCSURL+"/authorize", {
	email: username,
	password: password
    }).then(LCSResponse => {
	const code = LCSResponse.data.statusCode;
	if(code === 403){
	    throw new BadLogin();
	} else if (code !== 200) {
	    throw new BadResponse(LCSResponse);
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
	//this is some LCS specific trickery
	//looking for a user document with our email will give
	//us the entire user's document
	query: {email: email}
    }).then(response => {
	if (response.data.statusCode !== 200) {
	    throw new BadResponse(response);
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
		aud: stitchAppId,
		stitch_meta
	    }, secret, {
		expiresIn: 60*60*12 //12hrs
	    })
	    res.status(200).json({
		validLogin: true,
		token
            });
	}).catch(err => {
	    if(err.name === "BadLogin"){
		res.status(403).json({
		    validLogin: false,
		    err: err.message
		});
	    } else {
		console.log(err.name,err.message);
		res.status(500).json({
		    validLogin: false,
		    err: err.message
		})
	    }
	})
});

app.listen(port, function(){
    console.log("listening on port "+port);
});

