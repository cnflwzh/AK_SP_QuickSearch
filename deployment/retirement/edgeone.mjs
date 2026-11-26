import {handleRetirement} from './router.mjs';
import payload from 'virtual:wsq-retirement-payload';

/** EdgeOne Pages invokes root middleware for every request, including static files. */
export function middleware({request}) {
  return handleRetirement(request, 'https://ak.cnflwzh.top', payload);
}
