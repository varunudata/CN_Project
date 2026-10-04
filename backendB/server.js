const express = require('express');


const app = express()

app.get('/' , (req , res) => {
    return res.send('Hi from backendB')
})

app.listen(4000 , () => {
    console.log('backendB listening')
})