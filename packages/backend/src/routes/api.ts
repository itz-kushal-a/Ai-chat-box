import { Router } from 'express';
import { capitalize, ApiResponse } from 'shared';

const router = Router();

router.get('/hello', (_req, res) => {
  const response: ApiResponse<{ message: string }> = {
    success: true,
    data: { message: capitalize('hello from backend') },
  };
  res.json(response);
});

export default router;
