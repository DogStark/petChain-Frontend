import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as zlib from 'zlib';

@Injectable()
export class CompressionMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const acceptEncoding = req.headers['accept-encoding'] || '';

    // Skip compression for small responses or specific content types
    const originalSend = res.send;
    
    res.send = function(data: any): Response {
      if (typeof data === 'string' && data.length > 1024) {
        if (acceptEncoding.includes('gzip')) {
          res.setHeader('Content-Encoding', 'gzip');
          const compressed = zlib.gzipSync(data);
          return originalSend.call(this, compressed);
        } else if (acceptEncoding.includes('deflate')) {
          res.setHeader('Content-Encoding', 'deflate');
          const compressed = zlib.deflateSync(data);
          return originalSend.call(this, compressed);
        }
      }
      
      return originalSend.call(this, data);
    };

    next();
  }
}
