// src/types/express.d.ts
// Extiende Request para tipar el usuario decodificado del JWT.
import 'express';

declare global {
  namespace Express {
    interface Request {
      usuario?: {
        id: number;
        id_usuario: number;
        nombre: string;
        apellido: string;
        correo: string;
        rol: string;
        roles?: string[];
      };
      file?: Express.Multer.File;
    }
  }
}

export {};
