'use strict';


require('dotenv').config(); 


/**
 * Require the dependencies
 * @type {*|createApplication}
 */
var express = require('express');
var app = express();
var path = require('path');
var OAuthClient = require('intuit-oauth');
var bodyParser = require('body-parser');

// const { Pool, Client } = require('pg');


const db = require('./databaseUtils/dbconnect')
const { ppid } = require('process');
const { SSL_OP_NO_COMPRESSION } = require('constants');
const { Console } = require('console');
var ngrok =  (process.env.NGROK_ENABLED==="true") ? require('ngrok'):null;
var QuickBooks = require('node-quickbooks');
const { resolveNaptr } = require('dns');


/**
 * Configure View and Handlebars
 */
app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static(path.join(__dirname, '/public')));
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');
app.use(bodyParser.json())

var urlencodedParser = bodyParser.urlencoded({ extended: false });

/**
 * App Variables
 * @type {null}
 */
var oauth2_token_json = null,
    redirectUri = '';


/**
 * Instantiate new Client
 * @type {OAuthClient}
 */

var oauthClient = null;

var qbo = ''


/**
 * Home Route
 */
app.get('/', function(req, res) {

    res.render('index');
});


  


/**
 * Get the AuthorizeUri
 */
app.get('/authUri', urlencodedParser, function(req,res) {

    oauthClient = new OAuthClient({
        clientId: req.query.json.clientId,
        clientSecret: req.query.json.clientSecret,
        environment: req.query.json.environment,
        redirectUri: req.query.json.redirectUri
    });

    var authUri = oauthClient.authorizeUri({scope:[OAuthClient.scopes.Accounting],state:'intuit-test'}); 

    res.send(authUri);
});



async function isExist(realmId) { 
    let id; 
    console.log('is exist called. relmid = ', realmId)
    const query = `select id from tokens where realmid ='${realmId}'`

    // db
    // .query(query)
    // .then( res => {
    //         id = JSON.parse( JSON.stringify(res) )   

    //         console.log(res.rows.shift())
    //         id = res.rows.shift()
    //     }
    // )
    // .catch( e => console.log(e.stack))

    return await db.query(query)
    
}

async function insertTokens(accessToken, refreshToken,realmId, token_type, expires_in, refresh_token_expin) {

    const text = 'INSERT INTO tokens(access_tk, refresh_tk, realmid, token_type, expires_in, refresh_token_expires_in) VALUES($1, $2, $3, $4, $5, $6) RETURNING *; '
    const values = [accessToken, refreshToken, realmId, token_type, expires_in, refresh_token_expin] 

    let data = await isExist(realmId)
    let row = data.rows.shift()
    console.log('this is my data. ', row)

    let k = row ? row.id : 0
    if(parseInt(k) > 0) {
        return 
    } else {
        try{
            const r = await db.query(text, values) 
        } catch(e) {
            console.log(e)
        }
    }
}


/**
 * Handle the callback to extract the `Auth Code` and exchange them for `Bearer-Tokens`
 */
app.get('/callback', function(req, res) { 

    oauthClient.createToken(req.url) 
       .then(function(authResponse) {              
            const result = JSON.parse(authResponse.text())

            let d = JSON.parse(JSON.stringify(oauthClient))
    
            let row = {
                realmId: d.token.realmId,
                token_type: d.token.token_type,
                access_token: d.token.access_token,
                refresh_token: d.token.refresh_token,
                expires_in: d.token.expires_in,
                x_refresh_token_expires_in: d.token.x_refresh_token_expires_in
            }
            


            insertTokens(
                row.access_token, 
                row.refresh_token,
                row.realmId, 
                row.token_type, 
                row.expires_in, 
                row.x_refresh_token_expires_in
                )   


            oauth2_token_json = JSON.stringify(authResponse.getJson(), null,2);
         })
        .catch(function(e) {
             console.error(e);
         });

    res.send('');

});

/**
 * Display the token : CAUTION : JUST for sample purposes
 */
app.get('/retrieveToken', function(req, res) {  
    res.send(oauth2_token_json);
});


/**
 * Refresh the access-token
 */
app.get('/refreshAccessToken', function(req,res){

    oauthClient.refresh()
        .then(function(authResponse){ 

            // console.log('The Refresh Token is  '+ JSON.stringify(authResponse.getJson()));
            oauth2_token_json = JSON.stringify(authResponse.getJson(), null,2); 

            console.log('/refreshAccessToken')
            console.log('oauth2_token_json', JSON.parse(oauth2_token_json))


            res.send(oauth2_token_json);
        })
        .catch(function(e) {
            console.error(e);
        });


});
 



/**
 * getCompanyInfo ()
 */
app.get('/getCompanyInfo', function(req,res){

    var companyID = oauthClient.getToken().realmId;

    var url = oauthClient.environment == 'sandbox' ? OAuthClient.environment.sandbox : OAuthClient.environment.production ;

    oauthClient.makeApiCall({url: url + 'v3/company/' + companyID +'/companyinfo/' + companyID})
        .then(function(authResponse){ 
            // console.log("The response for API call is :"+JSON.stringify(authResponse)); 
            res.send(JSON.parse(authResponse.text()));
        })
        .catch(function(e) {
            console.error(e);
        });
});


/**
 * refere this url : https://www.npmjs.com/package/node-quickbooks#createaccountobject-callback
 * 
 */
app.get('/testing', function (req, resp) {

    

    qbo = new QuickBooks(
        oauthClient.clientId, 
        oauthClient.clientSecret,
        oauthClient.token.access_token, 
        false, 
        oauthClient.token.realmId, 
        true, 
        true, 
        null, 
        '2.0', 
        oauthClient.token.refresh_token
    )


    console.log('=oauthClient----------------------------------> ', oauthClient)
    console.log('=qbo----------------------------------> ', qbo)
    


    let acc = {
        "Name": "MyJobs_test_hello_world.", 
        "AccountType": "Accounts Receivable"
      }
    
    
    qbo.createAccount(acc, function(req, resp) {
        console.log("reqeust is ======> ", req)
        console.log("reqeust is ======> ", resp)
    })

    resp.send('Hello. ')

})



app.get('/test', function(req, res) {  
    
    db
    .query('select now() as now')
    .then(res => console.log(res.rows[0]))
    .catch(e => console.log(e.stack)) 
    
    res.send(db)
})

/**
 * Start server on HTTP (will use ngrok for HTTPS forwarding)
 */
const server = app.listen(process.env.PORT || 8000, () => {
    console.log(`💻 Server listening on port ${server.address().port}`);
if(!ngrok){
    redirectUri = `${server.address().port}` + '/callback';
    console.log(`💳  See the Sample App in your browser : ` + 'http://localhost:' + `${server.address().port}`);
    console.log(`💳  Copy this into Redirect URI on the browser : ` + 'http://localhost:' + `${server.address().port}` + '/callback');
    console.log(`💻  Make Sure this redirect URI is also copied on your app in : https://developer.intuit.com`);
}

});

/**
 * Optional : If NGROK is enabled
 */
if (ngrok) {

    console.log("NGROK Enabled");
    ngrok.connect({addr: process.env.PORT || 8000}, (err, url) => {
            if (err) {
                process.exit(1);
            }
            else {
                redirectUri = url + '/callback';
                console.log(`💳  See the Sample App in your browser: ${url}`);
                console.log(`💳  Copy and paste this Redirect URI on the browser :  ${redirectUri}`);
                console.log(`💻  Make Sure this redirect URI is also copied on your app in : https://developer.intuit.com`);

            }
        }
    );
}

