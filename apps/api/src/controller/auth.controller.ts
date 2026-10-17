import { Request, Response } from "express";

import { eq } from "drizzle-orm";
import db, { usersTable } from "@scheduler/db";
import JWT from "jsonwebtoken";
import bcrypt from "bcrypt";

export const registerUser = async (req: Request, res: Response) => {
  const { username: name, age, password, email } = res.locals.validated.body;

  const [user] = await db
    .select({
      id: usersTable.id,
    })
    .from(usersTable)
    .where(eq(usersTable.email, email))
    .limit(1);

  if (user) {
    return res.status(409).json({ message: "User already exists!" });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

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
  const { password, email } = res.locals.validated.body;

  const [user] = await db
    .select({
      id: usersTable.id,
      hashedPassword: usersTable.hashedPassword,
      email: usersTable.email,
    })
    .from(usersTable)
    .where(eq(usersTable.email, email))
    .limit(1);


  if (!user || !(await bcrypt.compare(password, user.hashedPassword))) {
    return res.status(401).json({ message: "Invalid credentials!" });
  }

  const { hashedPassword: _hashedPassword, ...userWithoutPassword } = user;

  const accessToken = JWT.sign(
    { id: user.id, email: user.email },
    process.env.JWT_ACCESS_TOKEN_SECRET as string,
    { expiresIn: "1h" }
  );
  const refreshToken = JWT.sign(
    { id: user.id, email: user.email },
    process.env.JWT_REFRESH_TOKEN_SECRET as string,
    { expiresIn: "7d" }
  );

  return res.status(200).json({
    message: "Login successful!",
    user: userWithoutPassword,
    accessToken,
    refreshToken,
  });
};
