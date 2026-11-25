import { CampaignHub } from '@/components/admin/CampaignHub';
import { AdminAreaPage } from './AdminAreas';
export default function AdminCampaigns() {
  return <AdminAreaPage area="admin_campaigns"><CampaignHub /></AdminAreaPage>;
}
