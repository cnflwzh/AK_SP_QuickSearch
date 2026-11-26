import {handleRetirement} from './router.mjs';
import payload from 'virtual:wsq-retirement-payload';

export default {
  fetch(request) {
    return handleRetirement(request, 'https://sp.enjoyacg.com', payload);
  },
};
