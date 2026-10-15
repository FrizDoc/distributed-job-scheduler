import express from "express";
import { validate } from "../middleware/validate";
import { userRegisterSchema } from "@scheduler/validations";
import { registerUser } from "../controller/auth.controller";
import e from "express";



const authRouter = express.Router();


authRouter.post("/register",validate({ body: userRegisterSchema }), registerUser);


export default authRouter;