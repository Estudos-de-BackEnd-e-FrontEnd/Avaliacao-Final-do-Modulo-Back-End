import express, { query, request, response } from "express";
import cors from "cors"
import { v4 as uuid} from "uuid";
import jwt from "jsonwebtoken"
 
const app = express()
app.use(express.json())
app.use(cors())

const port = 8080
app.listen(port)

const users = []
const userNotes = []

//Coloquei aqui so pra essa atividade mesmo, mas o correto seria colocar em um lugar seguro.
const SECRET_KEY = "0f7fcc1a-4301-4709-b10b-31804dc60b2e"

app.get("/", (request, response)=>{
    response.status(200).send(`
    <h1>CRUD de Recados, Criação de contas e Login de usuários.</h1>
    <h2>Rota de recados: /notes</h2>
    <p><b>Verbos:</b> POST, GET, PUT & DELETE</p>
    <p><i>obs: todos os verbos da rota recado, precisam do token gerado após o login, e precisam ser passados na header.</i></p>
    <p>-----------------------------------------------------------</p>
    <h2>Rota para cadastrar usuários: /user </h2>
    <p><b>Verbos:</b> POST</p>
    <p>-----------------------------------------------------------</p>
    <h2>Rota para entrar: /login</h2>
    <p><b>Verbos:</b> POST</p>
    <p>git da api: <a href="https://github.com/Estudos-de-BackEnd-e-FrontEnd/Avaliacao-Final-do-Modulo-Back-End" target="_blanck">Doc Crud Recados</a></p>
    `)
})

//middlewares
const verifyAuthTokenMiddleware = (request, response, next)=> {
/*     let token = decodeToken(request) */
    const token = decodeToken(request).notDecoded

    if(!token){
        return response.status(401).json({message: "Missing authorization headers"})
    }
  

    jwt.verify(token, SECRET_KEY, (error, decoded)=>{

        if(error){
            return response.status(401).json({message: "Unauthorized"})
        }

        const user = users.some((user)=> user.id === decoded.id)
        if(!user){
            return response.status(401).json({message: "Token invalid"})
        }
        next()
    })   
}
const verifyEmailAvailabilityMiddleware = (request, response, next) => {
    const {email} = request.body

    const userAlreadyExists = users.find((user) => user.email === email)

    if(userAlreadyExists){
        return response.status(400).json({message: "E-mail already registered"})
    }
    next()
}

const userSchemaValidationMiddleware = (request, response, next)=> {
    const {name, email, password} = request.body
    
    if(!name){
        return response.status(400).json({message: "The name field is required"})
    }

    if(!email){
        return response.status(400).json({message: "The email field is required"})
    }

    if(!password){
        return response.status(400).json({message: "The password field is required"})
    }

    const regexEmails = /^.+@.+\..+$/g

    if(!regexEmails.test(email)){
        return response.status(401).json({message: "This Email is invalid"})
    }
     
    let regexPassword = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/ 
    
    if(!regexPassword.test(password)){
        return response.status(401).json({message: "The password has to be at 8 characters long, one uppercase letter, onde lowercase letter and one digit "})
    }
    next()
}

const loginSchemaValidationMiddleware = (request, response, next)=>{
    const {email, password} = request.body

    if(!email){
        return response.status(400).send({message: "The email field is required"})
    }
    
    if(!password){
        return response.status(400).send({message: "The password field is required"})
    }

    const regexEmails = /^.+@.+\..+$/g
    if(!regexEmails.test(email)){
        return response.status(401).json({message: "This Email is invalid"})
    }
    next()
}

const notesSchemaValidationMiddleware = (request, response, next)=>{
    const {title, description} = request.body

    if(!title){
        return response.status(400).json({message: "The title field is required"})
    }

    if(!description){
        return response.status(400).json({message: "The description field is required"})
    }
    next()
}

const verifyCredentialsMiddleware = (request, response, next)=>{
    const {email, password} = request.body

    const isEmailCorrect = users.some((person)=> person.email === email)
    const isPasswordCorrect = users.some((person)=> person.password === password)

    if(!isEmailCorrect || !isPasswordCorrect){
        return response.status(401).json({message: "Wrong email or password"})
    }
    next()
}

const verifyIfHasNotes = (request, response, next)=>{
    const token = decodeToken(request).decoded
    const userNote = userNotes.find((person)=> person.id === token.id)
    
    if(userNote.notes.length === 0){
        return response.status(400).json({message: "The user doesn't have any notes"})
    }
    response.locals.token = token
    next()
    
    
}
//rotas
app.post("/user", userSchemaValidationMiddleware,  verifyEmailAvailabilityMiddleware,(request, response)=>{
    const {name, email, password} = request.body
    const id = uuid()

    users.push({id, name, email, password})
    userNotes.push({id, email, notes: []})

    return response.status(201).json({
        success: true,
        data: {
            id,
            name,
            email,
            password
        },
        message: "User created"
    })
})

app.post("/login", loginSchemaValidationMiddleware, verifyCredentialsMiddleware,(request, response)=>{
    const {email} = request.body
    const user = users.find((person)=> person.email === email)

    let token = jwt.sign({id: user.id}, SECRET_KEY, {expiresIn: "24h"})

    return response.status(200).json({
        success: true,
        data: {
            email,
            token
        },
        message: "User logged"
    })
})

app.post("/notes", verifyAuthTokenMiddleware, notesSchemaValidationMiddleware, (request, response)=>{
    const token = decodeToken(request).decoded
    const {title, description} = request.body

    const userNote = userNotes.find((person)=> person.id === token.id)

    const newNotes = {
        id: uuid(), 
        title, 
        description
    }
    userNote.notes.push(newNotes)

    return response.status(201).json({
        success: true,
        data: newNotes,
        message: "Note created"
    })
})

app.get("/notes", verifyAuthTokenMiddleware, verifyIfHasNotes,(request, response)=>{
    
    const limit =  Number(request.query.limit) || 5
    const page = Number(request.query.page) || 1

    const startIndex = (page - 1) * limit
    const endIndex = page * limit

    const userNote = userNotes.find((person)=> person.id === response.locals.token.id)
    
    const userNoteCopy = {...userNote}
    const slicedNotes = userNoteCopy.notes.slice(startIndex, endIndex)
    const numberOfPages = Math.ceil(userNoteCopy.notes.length / limit)

    const notes = {
        id: userNote.id,
        email: userNote.email,
        pages: numberOfPages,
        notes: slicedNotes

    }

    return response.status(200).json({
        success: true,
        data: notes,
        message: "Data listed successfully."
    })
})

app.put("/notes/:id", verifyAuthTokenMiddleware, notesSchemaValidationMiddleware, (request, response)=>{
    const token = decodeToken(request).decoded

    const {id} = request.params
    const {title, description} = request.body

    const userNote = userNotes.find((person)=> person.id === token.id)
    const note = userNote.notes.find((note)=> note.id === id )

    if(note === undefined){
        return response.status(400).json({message: "Note not found"})
    }
    
    note.title = title
    note.description = description

    return response.status(200).json({
        success: true,
        data: note,
        message: "Note updated"
    })
})

app.delete("/notes/:id", verifyAuthTokenMiddleware,(request, response)=>{
    const token = decodeToken(request).decoded
    const {id} = request.params

    const userNote = userNotes.find((person)=> person.id === token.id)
    const noteIndexToDelete = userNote.notes.findIndex((note)=> note.id === id )

    if(noteIndexToDelete === -1){
        return response.status(400).json({message: "Note not found"})
    }
    
    userNote.notes.splice(noteIndexToDelete, 1)
    return response.status(200).json({success: true, message: "The note was deleted"})
})

function decodeToken(request){
    const tokenReceived = request.headers.authorization
    const token = tokenReceived.split(' ')[1]
    const tokenDecoded = jwt.decode(token)
    return {decoded: tokenDecoded, notDecoded: token}
}