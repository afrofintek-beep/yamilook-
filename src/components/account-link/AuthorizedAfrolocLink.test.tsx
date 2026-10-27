import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,render} from '@testing-library/react';
import AuthorizedAfrolocLink from './AuthorizedAfrolocLink';
const {subscribe}=vi.hoisted(()=>({subscribe:vi.fn()}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{auth:{onAuthStateChange:subscribe}}}));
afterEach(()=>{cleanup();vi.unstubAllEnvs();vi.clearAllMocks();});
it('disabled integration has no UI or authentication subscription',()=>{
 vi.stubEnv('VITE_ACCOUNT_LINK_V1_ENABLED','false');
 const {container}=render(<AuthorizedAfrolocLink/>);
 expect(container).toBeEmptyDOMElement();expect(subscribe).not.toHaveBeenCalled();
});
