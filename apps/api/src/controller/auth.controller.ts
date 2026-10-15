import express, { Request, Response } from "express";

import { eq } from "drizzle-orm";
import db from "../db";
import { usersTable } from "../db/schema";

import bcrypt from "bcrypt";

export const registerUser = async (req: Request, res: Response) => {
  const { name, age, password, email } = req.body;

  const hashedPassword = bcrypt.hashSync(password, 10);

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email))
    .limit(1);

  if (user) {
    return res.status(409).json({ message: "User already exists!" });
  }
  const [newUser] = await db
    .insert(usersTable)
    .values({
      name,
      age,
      email,
      hashedPassword,
    })
    .returning();

  const { hashedPassword: _hashedPassword, ...userWithoutPassword } = newUser;

  return res.status(201).json({
    message: "Registration successful!",
    user: userWithoutPassword,
  });
};

export const loginUser = async (req: Request, res: Response) => {
  const { password, email } = req.body;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email))
    .limit(1);

  if (!user) {
    return res.status(404).json({ message: "Invalid credentials!" });
  }

  const isMatch = bcrypt.compareSync(password, user.hashedPassword);

  if (!isMatch) {
    return res.status(401).json({ message: "Invalid credentials!" });
  }

  const { hashedPassword: _hashedPassword, ...userWithoutPassword } = user;

  return res.status(200).json({
    message: "Login successful!",
    user: userWithoutPassword,
  });
};
