import JWT from 'jsonwebtoken';



const isAuthenticated = (req: any, res: any, next: any) => {
  const authHEader = req.headers.authorization;
  if (!authHEader) {
    return res.status(401).json({ message: 'Authorization header missing' });
  }

  const token = authHEader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Token missing' });
  }

  try {
    const decoded = JWT.verify(token, process.env.JWT_SECRET as string);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token' });
  }
}