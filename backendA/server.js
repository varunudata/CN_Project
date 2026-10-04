const express = require('express');


const app = express()


app.get('/' , (req , res) => {
    return res.send('Hi from backendA')
})

app.listen(6000 , () => {
    console.log('backendA listening')
})