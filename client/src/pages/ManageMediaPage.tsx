import * as api from '../api/api';
import { useState } from 'react';
import CopiesModal from '../components/CopiesModal';
import EntityManager from '../components/EntityManager';
import { PageHeader, useLoad } from '../components/ui';
import type { Media } from '../types';

const TYPES = ['DVD', 'Audiobook', 'Device', 'Other'].map((t) => ({ value: t, label: t }));

export default function ManageMediaPage() {
  const media = useLoad(api.listMedia);
  const [copiesOf, setCopiesOf] = useState<Record<string, any> | null>(null);
  return (
    <>
      <PageHeader title="Manage Media & Devices" subtitle="DVDs, audiobooks, calculators, headphones and other lendable items." />
      <EntityManager
        title="Media items"
        noun="Media item"
        idKey="media_id"
        rows={media.data ?? []}
        reload={media.reload}
        archivedLabel = "Archived media items"
        defaults={{ title: '', media_type: '', total_copies: 1, is_active: true }}
        fields={[
          { key: 'title', label: 'Title', type: 'text', required: true },
          { key: 'media_type', label: 'Type', type: 'select', required: true, options: TYPES },
          { key: 'total_copies', label: 'Total copies', type: 'number', required: true, formOnly: true, hint: 'Enter the new total to add or remove copies. Copies on loan or on hold cannot be removed.' },
          { key: 'copies', label: 'Copies (available / total)', type: 'text', tableOnly: true, render: (r) => `${r.available_copies} / ${r.total_copies}` },
          { key: 'is_active', label: 'Active', type: 'checkbox' },
        ]}
        onSave={(r) => api.saveMedia(r as Partial<Media> & { total_copies: number })}
        onDelete={(r) => api.deleteMedia(r.media_id)}
        rowActions={(r) => <button className="btn small" onClick={() => setCopiesOf(r)}>Copies</button>}
      />
      {copiesOf && <CopiesModal kind="media" id={copiesOf.media_id} title={copiesOf.title} onClose={() => setCopiesOf(null)} onChange={media.reload} />}
    </>
  );
}
