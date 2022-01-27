const {Pool, Client} = require('pg') 


const pool = new Pool({
    user: 'postgres', 
    host: 'localhost', 
    database: 'quickbook',
    password: 'postgres'
})


module.exports = pool
