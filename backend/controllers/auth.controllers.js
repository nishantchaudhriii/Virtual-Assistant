<<<<<<< HEAD
import genToken from "../config/token.js"
import User from "../models/user.model.js"
import bcrypt from "bcryptjs"

// sameSite "lax" works for localhost:5173 -> localhost:8000 (same site, different port)
const cookieOptions = {
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    sameSite: "lax",
    secure: false
}

const safeUser = (user) => {
    const obj = user.toObject()
    delete obj.password
    return obj
}

export const signUp = async (req, res) => {
    try {
        const { name, email, password } = req.body || {}

        if (!name || !email || !password) {
            return res.status(400).json({ message: "name, email and password are required !" })
        }
        if (password.length < 6) {
            return res.status(400).json({ message: "password must be at least 6 characters !" })
        }

        const normalizedEmail = email.trim().toLowerCase()
        const existEmail = await User.findOne({ email: normalizedEmail })
        if (existEmail) {
            return res.status(400).json({ message: "email already exists !" })
        }

        const hashedPassword = await bcrypt.hash(password, 10)
        const user = await User.create({ name: name.trim(), password: hashedPassword, email: normalizedEmail })

        const token = await genToken(user._id)
        res.cookie("token", token, cookieOptions)

        return res.status(201).json(safeUser(user))
    } catch (error) {
        console.error("signUp error:", error)
        return res.status(500).json({ message: `sign up error: ${error.message}` })
    }
}

export const Login = async (req, res) => {
    try {
        const { email, password } = req.body || {}
        if (!email || !password) {
            return res.status(400).json({ message: "email and password are required !" })
        }

        const user = await User.findOne({ email: email.trim().toLowerCase() })
        if (!user) {
            return res.status(400).json({ message: "email does not exists !" })
        }

        const isMatch = await bcrypt.compare(password, user.password)
        if (!isMatch) {
            return res.status(400).json({ message: "incorrect password" })
        }

        const token = await genToken(user._id)
        res.cookie("token", token, cookieOptions)

        return res.status(200).json(safeUser(user))
    } catch (error) {
        console.error("login error:", error)
        return res.status(500).json({ message: `login error: ${error.message}` })
    }
}

export const logOut = async (req, res) => {
    try {
        res.clearCookie("token", cookieOptions)
        return res.status(200).json({ message: "log out successfully" })
    } catch (error) {
        return res.status(500).json({ message: `logout error: ${error.message}` })
    }
}
=======
import genToken from "../config/token.js"
import User from "../models/user.model.js"
import bcrypt from "bcryptjs"
export const signUp=async (req,res)=>{
try {
    const {name,email,password}=req.body

    const existEmail=await User.findOne({email})
    if(existEmail){
        return res.status(400).json({message:"email already exists !"})
    }
    if(password.length<6){
        return res.status(400).json({message:"password must be at least 6 characters !"})
    }

    const hashedPassword=await bcrypt.hash(password,10)

    const user=await User.create({
        name,password:hashedPassword,email
    })

    const token=await genToken(user._id)

    res.cookie("token",token,{
        httpOnly:true,
       maxAge:7*24*60*60*1000,
       sameSite:"none",
       secure:true
    })

    return res.status(201).json(user)

} catch (error) {
       return res.status(500).json({message:`sign up error ${error}`})
}
}

export const Login=async (req,res)=>{
try {
    const {email,password}=req.body

    const user=await User.findOne({email})
    if(!user){
        return res.status(400).json({message:"email does not exists !"})
    }
   const isMatch=await bcrypt.compare(password,user.password)

   if(!isMatch){
   return res.status(400).json({message:"incorrect password"})
   }

    const token=await genToken(user._id)

    res.cookie("token",token,{
        httpOnly:true,
       maxAge:7*24*60*60*1000,
       sameSite:"none",
       secure:true
    })

    return res.status(200).json(user)

} catch (error) {
       return res.status(500).json({message:`login error ${error}`})
}
}

export const logOut=async (req,res)=>{
    try {
        res.clearCookie("token")
         return res.status(200).json({message:"log out successfully"})
    } catch (error) {
         return res.status(500).json({message:`logout error ${error}`})
    }
}
        
>>>>>>> origin/main
