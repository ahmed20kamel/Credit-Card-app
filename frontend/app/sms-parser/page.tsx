'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/app/store/authStore';
import { cardsAPI, Card } from '@/app/api/cards';
import { transactionsAPI } from '@/app/api/transactions';
import api from '@/app/api/client';
import Layout from '@/components/Layout';
import { useTranslations } from '@/lib/i18n';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import toast from 'react-hot-toast';
import { 
  MessageSquare, 
  CheckCircle, 
  AlertCircle, 
  Loader,
  Upload,
  FileText,
  Image as ImageIcon,
  PenTool,
  X,
  Edit
} from 'lucide-react';

type InputMode = 'text' | 'image' | 'manual';

export default function TransactionImporterPage() {
  const router = useRouter();
  const { isAuthenticated, loadUser } = useAuthStore();
  const { t } = useTranslations();
  const [cards, setCards] = useState<Card[]>([]);
  const [inputMode, setInputMode] = useState<InputMode>('text');
  const [smsBody, setSmsBody] = useState('');
  const [sender, setSender] = useState('');
  const [parsedData, setParsedData] = useState<any>(null);
  const [selectedCard, setSelectedCard] = useState('');
  const [autoCreate, setAutoCreate] = useState(true);
  const [loading, setLoading] = useState(false);
  const [editingParsed, setEditingParsed] = useState(false);
  const [editedData, setEditedData] = useState<any>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  // Manual entry form
  const [manualForm, setManualForm] = useState({
    card_id: '',
    transaction_type: 'purchase',
    amount: '',
    currency: 'AED',
    merchant_name: '',
    description: '',
    category: '',
    transaction_date: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    if (!isAuthenticated) {
      loadUser().catch(() => router.push('/login'));
    }
  }, [isAuthenticated, loadUser, router]);

  useEffect(() => {
    if (isAuthenticated) {
      cardsAPI.list().then((res) => setCards(res.items || []));
    }
  }, [isAuthenticated]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleParseText = async () => {
    if (!smsBody.trim()) {
      toast.error(t('errors.required'));
      return;
    }

    setLoading(true);
    setEditingParsed(false);
    setEditedData(null);
    
    try {
      const response = await api.post('/cards/parse-sms/', {
        sms_body: smsBody,
        sender: sender || 'Unknown',
        auto_create: false, // Always parse first, create separately
        card_id: selectedCard || null,
      });

      const data = response.data;
      
      if (data.matched_card_id && !selectedCard) {
        setSelectedCard(data.matched_card_id);
      } else if (data.suggested_card_id && !selectedCard) {
        setSelectedCard(data.suggested_card_id);
      }
      
      if (data.error) {
        toast.error(data.error || t('addTransaction.parsingFailed'));
        setParsedData(null);
      } else if (data.duplicate) {
        toast.error(t('addTransaction.duplicateMessage'));
        setParsedData(data);
      } else {
        setParsedData(data);
        setEditedData(data);
        
        // Auto-create if enabled
        if (autoCreate && !data.duplicate && !data.error) {
          await handleCreateTransaction(data);
        }
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || t('addTransaction.parsingFailed');
      toast.error(errorMsg);
      setParsedData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTransaction = async (dataToCreate?: any) => {
    const data = dataToCreate || editedData || parsedData;
    if (!data || !data.amount) {
      toast.error(t('addTransaction.parsingFailed'));
      return;
    }

    setLoading(true);
    try {
      const transactionData: any = {
        transaction_type: data.transaction_type || 'purchase',
        amount: parseFloat(data.amount),
        currency: data.currency || 'AED',
        merchant_name: data.merchant_name || null,
        description: data.description || smsBody,
        category: data.category || null,
        transaction_date: data.transaction_date || new Date().toISOString().split('T')[0],
      };

      if (selectedCard || data.matched_card_id || data.suggested_card_id) {
        transactionData.card_id = selectedCard || data.matched_card_id || data.suggested_card_id;
      }

      await transactionsAPI.create(transactionData);

      toast.success(t('success.transactionCreated'));
      setSmsBody('');
      setParsedData(null);
      setEditedData(null);
      setSelectedCard('');
      setEditingParsed(false);
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || err.response?.data?.error || t('errors.generic');
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleImageParse = async () => {
    if (!imageFile) {
      toast.error(t('errors.required'));
      return;
    }

    // TODO: Implement OCR/image processing
    toast(t('addTransaction.imageNote'), { icon: 'ℹ️' });
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const transactionData: any = {
        transaction_type: manualForm.transaction_type,
        amount: parseFloat(manualForm.amount),
        currency: manualForm.currency,
        merchant_name: manualForm.merchant_name || null,
        description: manualForm.description || null,
        category: manualForm.category || null,
        transaction_date: manualForm.transaction_date,
      };
      
      if (manualForm.card_id) {
        transactionData.card_id = manualForm.card_id;
      }
      
      await transactionsAPI.create(transactionData);
      toast.success(t('success.transactionCreated'));
      
      // Reset form
      setManualForm({
        card_id: '',
        transaction_type: 'purchase',
        amount: '',
        currency: 'AED',
        merchant_name: '',
        description: '',
        category: '',
        transaction_date: new Date().toISOString().split('T')[0],
      });
      
      // Optionally redirect to transactions
      router.push('/transactions');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || err.response?.data?.error || t('errors.generic'));
    }
  };

  if (!isAuthenticated) return null;

  return (
    <Layout>
      <div className="sms-parser-page">
        <div className="page-header-section">
          <div className="page-header-content">
            <div className="page-header-icon">
              <Upload size={32} />
            </div>
            <div className="page-header-text">
              <h1>{t('addTransaction.title')}</h1>
              <p className="page-subtitle">{t('addTransaction.subtitle')}</p>
            </div>
          </div>
        </div>

        {/* Input Mode Selector */}
        <div className="card mode-selector-card">
          <div className="section-header">
            <h2 className="section-title-small">{t('addTransaction.chooseMethod')}</h2>
          </div>
          <div className="mode-selector-grid">
            <button
              onClick={() => setInputMode('text')}
              className={`mode-selector-btn ${inputMode === 'text' ? 'mode-selector-btn-active' : ''}`}
            >
              <FileText size={32} className="mode-selector-icon" />
              <p className="mode-selector-title">{t('addTransaction.textSms')}</p>
              <p className="mode-selector-desc">{t('addTransaction.textSmsDesc')}</p>
            </button>
            <button
              onClick={() => setInputMode('image')}
              className={`mode-selector-btn ${inputMode === 'image' ? 'mode-selector-btn-active' : ''}`}
            >
              <ImageIcon size={32} className="mode-selector-icon" />
              <p className="mode-selector-title">{t('addTransaction.image')}</p>
              <p className="mode-selector-desc">{t('addTransaction.imageDesc')}</p>
            </button>
            <button
              onClick={() => setInputMode('manual')}
              className={`mode-selector-btn ${inputMode === 'manual' ? 'mode-selector-btn-active' : ''}`}
            >
              <PenTool size={32} className="mode-selector-icon" />
              <p className="mode-selector-title">{t('addTransaction.manual')}</p>
              <p className="mode-selector-desc">{t('addTransaction.manualDesc')}</p>
            </button>
          </div>
        </div>

        {/* Text/SMS Input */}
        {inputMode === 'text' && (
          <div className="card form-card">
            <div className="section-header">
              <MessageSquare size={20} />
              <h2 className="section-title">{t('addTransaction.importFromText')}</h2>
              <div className="info-icon-wrapper">
                <div className="info-icon">i</div>
                <div className="examples-tooltip">
                  <div className="examples-tooltip-header">
                    <h4 className="examples-tooltip-title">{t('addTransaction.exampleMessages')}</h4>
                  </div>
                  <div className="examples-list">
                    <div className="example-item example-item-primary">
                      <p className="example-item-title">{t('addTransaction.englishExample')}</p>
                      <p className="example-item-text">
                        Your Cr.Card XXX3287 was used for AED756.76 on 10/02/2026 13:36:02 at ICP Smart Services,ABU DHABI-AE. Avl. Cr.limit is AED2375.81
                      </p>
                    </div>
                    <div className="example-item example-item-success">
                      <p className="example-item-title">{t('addTransaction.arabicExample')}</p>
                      <p className="example-item-text">
                        تمت عملية شراء في AED 74.00 LULU HYPERMARKET LLC B,ABU DHABI على البطاقة 7665 الائتمان المتوفر AED10.90
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <p className="form-description">
              {t('addTransaction.textInstructions')}
            </p>

            <div className="form-group">
              <label className="form-label">
                {t('addTransaction.sender')}
              </label>
              <input
                type="text"
                value={sender}
                onChange={(e) => setSender(e.target.value)}
                placeholder={t('addTransaction.senderPlaceholder')}
                className="form-input"
              />
              <p className="form-help-text">{t('addTransaction.senderHelp')}</p>
            </div>

            <div className="form-group">
              <div className="form-label-row">
                <label className="form-label">
                  {t('addTransaction.transactionText')}
                </label>
                <span className="form-required-badge">{t('addTransaction.transactionTextRequired')}</span>
              </div>
              <textarea
                value={smsBody}
                onChange={(e) => setSmsBody(e.target.value)}
                placeholder={t('addTransaction.textPlaceholder')}
                className="form-input form-textarea"
                rows={6}
              />
              <div className="form-example">
                <p className="form-example-label">{t('addTransaction.exampleLabel')}</p>
                <div className="form-example-item" onClick={() => {
                  const example = "Your Cr.Card XXX3287 was used for AED756.76 on 10/02/2026 13:36:02 at ICP Smart Services,ABU DHABI-AE. Avl. Cr.limit is AED2375.81";
                  navigator.clipboard.writeText(example).then(() => {
                    setSmsBody(example);
                    toast.success('Example copied!');
                  });
                }}>
                  <code className="form-example-code">
                    Your Cr.Card XXX3287 was used for AED756.76 on 10/02/2026 13:36:02 at ICP Smart Services,ABU DHABI-AE. Avl. Cr.limit is AED2375.81
                  </code>
                  <span className="form-example-copy">Click to use</span>
                </div>
              </div>
            </div>

            <div className="auto-create-section">
              <div className="auto-create-header">
                <h3 className="auto-create-title">{t('addTransaction.autoCreate')}</h3>
                <label className="auto-create-toggle">
                  <input
                    type="checkbox"
                    checked={autoCreate}
                    onChange={(e) => setAutoCreate(e.target.checked)}
                    className="auto-create-checkbox"
                  />
                  <span className="auto-create-switch"></span>
                </label>
              </div>
              <p className="auto-create-desc">{t('addTransaction.autoCreateDesc')}</p>

              {autoCreate && (
                <div className="auto-create-card-select">
                  <label className="auto-create-card-label">
                    {t('addTransaction.selectCard')}
                  </label>
                  <SearchableSelect
                    value={selectedCard}
                    onChange={setSelectedCard}
                    options={[t('addTransaction.autoDetect'), ...cards.map((c) => `${c.card_name} - ${c.bank_name} (****${c.card_last_four})`)]}
                    optionValues={['', ...cards.map((c) => c.id)]}
                    placeholder={t('common.search')}
                    noMatchesText={t('common.noMatches')}
                    aria-label={t('addTransaction.selectCard')}
                  />
                  <p className="auto-create-card-help">{t('addTransaction.selectCardHelp')}</p>
                </div>
              )}
            </div>

            <button
              onClick={handleParseText}
              disabled={loading || !smsBody.trim()}
              className="btn btn-primary btn-full"
            >
              {loading ? (
                <>
                  <Loader className="animate-spin" size={20} />
                  <span>{t('addTransaction.parsing')}</span>
                </>
              ) : (
                <>
                  <MessageSquare size={20} />
                  <span>{autoCreate ? t('addTransaction.parseImport') : t('addTransaction.parseOnly')}</span>
                </>
              )}
            </button>

            {parsedData && !parsedData.error && !parsedData.duplicate && (
              <div className="form-section">
                <div className="parsed-preview-header">
                  <h3 className="form-section-title">{t('addTransaction.parsedData')}</h3>
                  {!autoCreate && (
                    <button
                      onClick={() => setEditingParsed(!editingParsed)}
                      className="btn btn-secondary btn-sm"
                    >
                      <Edit size={16} />
                      <span>{t('addTransaction.editParsedData')}</span>
                    </button>
                  )}
                </div>
                <div className="parsed-data-card">
                  {editingParsed ? (
                    <div className="parsed-edit-form">
                      <div className="form-row">
                        <div className="form-group">
                          <label className="form-label">{t('transactions.amount')} *</label>
                          <input
                            type="number"
                            step="0.01"
                            value={editedData?.amount || ''}
                            onChange={(e) => setEditedData({ ...editedData, amount: e.target.value })}
                            className="form-input"
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">{t('addTransaction.currency')}</label>
                          <input
                            type="text"
                            value={editedData?.currency || 'AED'}
                            onChange={(e) => setEditedData({ ...editedData, currency: e.target.value })}
                            className="form-input"
                            maxLength={3}
                          />
                        </div>
                      </div>
                      <div className="form-group">
                        <label className="form-label">{t('addTransaction.transactionType')}</label>
                        <SearchableSelect
                          value={editedData?.transaction_type || 'purchase'}
                          onChange={(v) => setEditedData({ ...editedData, transaction_type: v })}
                          options={[t('transactions.purchase'), t('transactions.withdrawal'), t('transactions.payment'), t('transactions.refund'), t('transactions.transfer')]}
                          optionValues={['purchase', 'withdrawal', 'payment', 'refund', 'transfer']}
                          placeholder={t('common.search')}
                          noMatchesText={t('common.noMatches')}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">{t('transactions.merchant')}</label>
                        <input
                          type="text"
                          value={editedData?.merchant_name || ''}
                          onChange={(e) => setEditedData({ ...editedData, merchant_name: e.target.value })}
                          className="form-input"
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">{t('addTransaction.transactionDate')}</label>
                        <input
                          type="date"
                          value={editedData?.transaction_date || new Date().toISOString().split('T')[0]}
                          onChange={(e) => setEditedData({ ...editedData, transaction_date: e.target.value })}
                          className="form-input"
                        />
                      </div>
                      <div className="form-actions">
                        <button
                          onClick={() => setEditingParsed(false)}
                          className="btn btn-secondary"
                        >
                          {t('common.cancel')}
                        </button>
                        <button
                          onClick={() => {
                            setParsedData(editedData);
                            setEditingParsed(false);
                          }}
                          className="btn btn-primary"
                        >
                          {t('common.save')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="parsed-data-grid">
                        <div className="parsed-data-item">
                          <span className="parsed-data-label">{t('transactions.amount')}:</span>
                          <p className="parsed-data-value parsed-data-amount">
                            {parsedData.amount ? `${parsedData.amount} ${parsedData.currency || 'AED'}` : 'N/A'}
                          </p>
                        </div>
                        <div className="parsed-data-item">
                          <span className="parsed-data-label">{t('addTransaction.type')}:</span>
                          <p className="parsed-data-value capitalize">{parsedData.transaction_type || 'N/A'}</p>
                        </div>
                        <div className="parsed-data-item">
                          <span className="parsed-data-label">{t('addTransaction.bank')}:</span>
                          <p className="parsed-data-value">{parsedData.bank_name || 'N/A'}</p>
                        </div>
                        <div className="parsed-data-item">
                          <span className="parsed-data-label">{t('addTransaction.card')}:</span>
                          <p className="parsed-data-value">**** {parsedData.card_last_four || 'N/A'}</p>
                        </div>
                        {parsedData.merchant_name && (
                          <div className="parsed-data-item parsed-data-item-full">
                            <span className="parsed-data-label">{t('transactions.merchant')}:</span>
                            <p className="parsed-data-value">{parsedData.merchant_name}</p>
                          </div>
                        )}
                        {parsedData.transaction_date && (
                          <div className="parsed-data-item">
                            <span className="parsed-data-label">{t('transactions.date')}:</span>
                            <p className="parsed-data-value">{parsedData.transaction_date}</p>
                          </div>
                        )}
                      </div>
                      {!autoCreate && (
                        <div className="parsed-preview-actions">
                          <button
                            onClick={() => handleCreateTransaction()}
                            disabled={loading}
                            className="btn btn-primary btn-full"
                          >
                            {loading ? (
                              <>
                                <Loader className="animate-spin" size={20} />
                                <span>{t('addTransaction.parsing')}</span>
                              </>
                            ) : (
                              <>
                                <CheckCircle size={20} />
                                <span>{t('addTransaction.createTransaction')}</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
            
            {parsedData?.duplicate && (
              <div className="form-section">
                <div className="alert alert-warning">
                  <AlertCircle size={20} />
                  <div>
                    <p className="alert-title">{t('addTransaction.duplicateDetected')}</p>
                    <p className="alert-text">{t('addTransaction.duplicateMessage')}</p>
                  </div>
                </div>
              </div>
            )}
            
            {parsedData?.error && (
              <div className="form-section">
                <div className="alert alert-error">
                  <AlertCircle size={20} />
                  <p className="alert-title">{parsedData.error || t('addTransaction.parsingFailed')}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Image Input */}
        {inputMode === 'image' && (
          <div className="card form-card">
            <div className="section-header">
              <ImageIcon size={20} />
              <h2 className="section-title">{t('addTransaction.importFromImage')}</h2>
            </div>
            <p className="form-description">
              {t('addTransaction.imageInstructions')}
            </p>

            <div className="form-group">
              <label className="form-label">
                {t('addTransaction.uploadImage')}
              </label>
              <div className="image-upload-area">
                {imagePreview ? (
                  <div className="image-preview-wrapper">
                    <img src={imagePreview} alt="Preview" className="image-preview" />
                    <button
                      onClick={() => {
                        setImageFile(null);
                        setImagePreview(null);
                      }}
                      className="image-remove-btn"
                    >
                      <X size={20} />
                    </button>
                  </div>
                ) : (
                  <div className="image-upload-placeholder">
                    <ImageIcon size={48} className="image-upload-icon" />
                    <p className="image-upload-text">{t('addTransaction.clickToUpload')}</p>
                    <p className="image-upload-hint">{t('addTransaction.imageFormats')}</p>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                      id="image-upload"
                    />
                    <label
                      htmlFor="image-upload"
                      className="btn btn-primary"
                    >
                      {t('addTransaction.selectImage')}
                    </label>
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={handleImageParse}
              disabled={!imageFile}
              className="btn btn-primary btn-full"
            >
              <ImageIcon size={20} />
              <span>{t('addTransaction.extractImport')}</span>
            </button>

            <div className="alert alert-warning">
              <AlertCircle size={20} />
              <p className="alert-text">{t('addTransaction.imageNote')}</p>
            </div>
          </div>
        )}

        {/* Manual Entry */}
        {inputMode === 'manual' && (
          <div className="card form-card">
            <div className="section-header">
              <PenTool size={20} />
              <h2 className="section-title">{t('addTransaction.manualEntry')}</h2>
            </div>
            <p className="form-description">
              {t('addTransaction.manualInstructions')}
            </p>

            <form onSubmit={handleManualSubmit} className="form-layout">
              <div className="form-group">
                <label className="form-label">{t('addTransaction.cardOptional')}</label>
                <SearchableSelect
                  value={manualForm.card_id}
                  onChange={(v) => setManualForm({ ...manualForm, card_id: v })}
                  options={[t('addTransaction.noneCash'), ...cards.map((c) => `${c.card_name} - ****${c.card_last_four}`)]}
                  optionValues={['', ...cards.map((c) => c.id)]}
                  placeholder={t('common.search')}
                  noMatchesText={t('common.noMatches')}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">{t('addTransaction.transactionType')} *</label>
                  <SearchableSelect
                    value={manualForm.transaction_type}
                    onChange={(v) => setManualForm({ ...manualForm, transaction_type: v })}
                    options={[t('transactions.purchase'), t('transactions.withdrawal'), t('transactions.payment'), t('transactions.refund'), t('transactions.transfer')]}
                    optionValues={['purchase', 'withdrawal', 'payment', 'refund', 'transfer']}
                    placeholder={t('common.search')}
                    noMatchesText={t('common.noMatches')}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">{t('addTransaction.amount')} *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={manualForm.amount}
                    onChange={(e) => setManualForm({ ...manualForm, amount: e.target.value })}
                    className="form-input"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">{t('addTransaction.currency')}</label>
                  <input
                    type="text"
                    value={manualForm.currency}
                    onChange={(e) => setManualForm({ ...manualForm, currency: e.target.value })}
                    className="form-input"
                    maxLength={3}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">{t('addTransaction.transactionDate')} *</label>
                  <input
                    type="date"
                    required
                    value={manualForm.transaction_date}
                    onChange={(e) => setManualForm({ ...manualForm, transaction_date: e.target.value })}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">{t('addTransaction.merchantName')}</label>
                <input
                  type="text"
                  value={manualForm.merchant_name}
                  onChange={(e) => setManualForm({ ...manualForm, merchant_name: e.target.value })}
                  className="form-input"
                  placeholder={t('addTransaction.merchantPlaceholder')}
                />
              </div>

              <div className="form-group">
                <label className="form-label">{t('addTransaction.description')}</label>
                <textarea
                  value={manualForm.description}
                  onChange={(e) => setManualForm({ ...manualForm, description: e.target.value })}
                  className="form-input form-textarea"
                  rows={3}
                  placeholder={t('addTransaction.descriptionPlaceholder')}
                />
              </div>

              <div className="form-group">
                <label className="form-label">{t('addTransaction.category')}</label>
                <input
                  type="text"
                  value={manualForm.category}
                  onChange={(e) => setManualForm({ ...manualForm, category: e.target.value })}
                  className="form-input"
                  placeholder={t('addTransaction.categoryPlaceholder')}
                />
              </div>

              <div className="form-actions">
                <button
                  type="submit"
                  className="btn btn-primary btn-full"
                >
                  {t('addTransaction.createTransaction')}
                </button>
                <button
                  type="button"
                  onClick={() => router.push('/transactions')}
                  className="btn btn-secondary btn-full"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          </div>
        )}

      </div>
    </Layout>
  );
}
