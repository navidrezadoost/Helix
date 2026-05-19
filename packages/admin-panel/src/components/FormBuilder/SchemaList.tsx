import { useEffect, useMemo, useState, type FC } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search, FileText, Loader2 } from 'lucide-react';
import { AdminThemeToggle } from '../AdminThemeToggle';
import { schemaApi, type Schema } from '../../api/schemas';
import { useHelixAdmin } from '../../context/HelixAdminProvider';

interface SchemaListProps {
  onSelectSchema: (schemaId: string) => void;
  onCreateNew: () => void;
  className?: string;
}

export const SchemaList: FC<SchemaListProps> = ({ onSelectSchema, onCreateNew, className }) => {
  const [schemas, setSchemas] = useState<Schema[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const { t } = useHelixAdmin();

  useEffect(() => {
    const loadSchemas = async () => {
      setLoading(true);
      try {
        const response = await schemaApi.list({ status: statusFilter || undefined });
        setSchemas(response.data);
      } catch (error) {
        console.error('Failed to load schemas', error);
      } finally {
        setLoading(false);
      }
    };

    void loadSchemas();
  }, [statusFilter]);

  const filteredSchemas = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    if (!needle) {
      return schemas;
    }

    return schemas.filter((schema) => {
      return schema.name.toLowerCase().includes(needle)
        || schema.schema_id.toLowerCase().includes(needle);
    });
  }, [filter, schemas]);

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (index: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        delay: index * 0.05,
        type: 'spring',
        stiffness: 300,
        damping: 30,
      },
    }),
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.05 },
    },
  };

  if (loading) {
    return (
      <div className="fb-container fb-loading">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        >
          <Loader2 className="w-6 h-6" />
        </motion.div>
        <span style={{ marginLeft: '12px' }}>{t('loadingSchema')}</span>
      </div>
    );
  }

  return (
    <div className={`fb-container fb-schema-list ${className ?? ''}`.trim()}>
      <motion.div
        className="fb-schema-list-header"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1>{t('forms')}</h1>
        <div className="fb-schema-header-actions">
          <AdminThemeToggle />
          <motion.button
            type="button"
            className="fb-btn fb-btn-primary"
            onClick={onCreateNew}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Plus className="w-4 h-4" />
            {t('createNewForm')}
          </motion.button>
        </div>
      </motion.div>

      <motion.div
        className="fb-schema-filters"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <div style={{ position: 'relative', flex: 1, maxWidth: '320px' }}>
          <Search
            className="w-4 h-4"
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#a3a3a3',
            }}
          />
          <input
            type="text"
            placeholder={t('searchForms')}
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            className="fb-input fb-search-input"
            style={{ paddingLeft: '40px' }}
          />
        </div>
        <select value={statusFilter} onChange={(event: any) => setStatusFilter(event.target.value)}>
          <option value="">{t('allStatuses')}</option>
          <option value="draft">{t('draft')}</option>
          <option value="published">{t('published')}</option>
          <option value="archived">{t('archived')}</option>
        </select>
      </motion.div>

      {filteredSchemas.length === 0 ? (
        <motion.div className="fb-empty-state" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <FileText className="w-16 h-16 mb-4" strokeWidth={1} style={{ color: '#d4d4d4' }} />
          <p>No forms found. Create your first form to get started.</p>
        </motion.div>
      ) : (
        <motion.div
          className="fb-schema-grid"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {filteredSchemas.map((schema, index) => (
            <motion.button
              key={schema.id ?? `${schema.schema_id}-${schema.version}`}
              type="button"
              className="fb-schema-card"
              onClick={() => onSelectSchema(schema.schema_id)}
              variants={cardVariants}
              custom={index}
              whileHover={{ y: -4, scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
            >
              <div className="fb-schema-card-header">
                <h3>{schema.name}</h3>
                <span className={`fb-status fb-status-${schema.status}`}>{schema.status}</span>
              </div>
              <p className="fb-schema-card-description">
                {schema.description || 'No description'}
              </p>
              <div className="fb-schema-card-meta">
                <span>ID: {schema.schema_id}</span>
                <span className="fb-version">v{schema.version}</span>
                <span>
                  Updated: {schema.updated_at ? new Date(schema.updated_at).toLocaleDateString() : '—'}
                </span>
              </div>
            </motion.button>
          ))}
        </motion.div>
      )}
    </div>
  );
};
