import express from "express";
import { validate } from "../middleware/validate";
import { userLoginSchema, userRegisterSchema } from "@scheduler/validations";
import { loginUser, registerUser } from "../controller/auth.controller";

const authRouter = express.Router();

authRouter.post("/register", validate({ body: userRegisterSchema }), registerUser);
authRouter.post("/login", validate({ body: userLoginSchema }), loginUser);

export default authRouter;
