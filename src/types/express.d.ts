export {};

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      admin?: {
        id: string;
        email: string;
        name: string;
        role: "admin";
      };
    }
  }
}
