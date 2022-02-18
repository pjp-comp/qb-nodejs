const db = require("./dbconnect")

console.log('db' , db)

// let q = db.query('select NOW()', (err, res) => {
//     console.log(err, res)
//     db.end()
// })

function executeQuery(query) {

    db.query(query, (e, r) => {
        console.log(e, r)
        
    })
}


module.exports = executeQuery



