// src/components/SubmitExpense.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import Tesseract from 'tesseract.js';

function SubmitExpense({ user }) {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [formData, setFormData] = useState({
    amount: '',
    currency: user.currency || 'USD',
    categoryId: '',
    description: '',
    expenseDate: new Date().toISOString().split('T')[0],
    merchantName: '',
    lineItems: []
  });
  const [receiptFile, setReceiptFile] = useState(null);
  const [ocrProcessing, setOcrProcessing] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [currentStep, setCurrentStep] = useState(1);

  const currencies = ['USD', 'EUR', 'GBP', 'INR', 'JPY', 'AUD', 'CAD', 'CNY'];

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await axios.get('/categories');
      setCategories(response.data);
      if (response.data.length > 0) {
        setFormData(prev => ({ ...prev, categoryId: response.data[0].id }));
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setReceiptFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const processOCR = async () => {
    if (!receiptFile) {
      alert('Please upload a receipt first');
      return;
    }

    setOcrProcessing(true);
    setError('');
    setOcrProgress(0);

    try {
      const result = await Tesseract.recognize(
        receiptFile,
        'eng',
        {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              setOcrProgress(Math.round(m.progress * 100));
            }
          }
        }
      );

      const text = result.data.text;
      const extractedData = extractReceiptData(text);
      
      setFormData(prev => ({
        ...prev,
        amount: extractedData.amount || prev.amount,
        merchantName: extractedData.merchantName || prev.merchantName,
        expenseDate: extractedData.date || prev.expenseDate,
        description: extractedData.description || prev.description,
        lineItems: extractedData.lineItems || prev.lineItems
      }));

      setCurrentStep(2);
      alert('OCR processing complete! Please verify the extracted data.');

    } catch (error) {
      console.error('OCR Error:', error);
      setError('Failed to process receipt. Please enter details manually.');
    } finally {
      setOcrProcessing(false);
      setOcrProgress(0);
    }
  };

  const extractReceiptData = (text) => {
    const data = {
      amount: '',
      merchantName: '',
      date: '',
      description: '',
      lineItems: []
    };

    const amountPatterns = [
      /total[:\s]*\$?\s*([\d,]+\.?\d*)/i,
      /amount[:\s]*\$?\s*([\d,]+\.?\d*)/i,
      /\$\s*([\d,]+\.?\d*)/
    ];

    for (const pattern of amountPatterns) {
      const match = text.match(pattern);
      if (match) {
        data.amount = match[1].replace(',', '');
        break;
      }
    }

    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length > 0) {
      data.merchantName = lines[0].trim().substring(0, 100);
    }

    const datePatterns = [
      /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/,
      /(\d{2,4}[\/\-]\d{1,2}[\/\-]\d{1,2})/
    ];

    for (const pattern of datePatterns) {
      const match = text.match(pattern);
      if (match) {
        try {
          const dateStr = match[1];
          const parts = dateStr.split(/[\/\-]/);
          let year, month, day;
          
          if (parts[0].length === 4) {
            year = parts[0];
            month = parts[1].padStart(2, '0');
            day = parts[2].padStart(2, '0');
          } else {
            month = parts[0].padStart(2, '0');
            day = parts[1].padStart(2, '0');
            year = parts[2].length === 2 ? '20' + parts[2] : parts[2];
          }
          
          data.date = `${year}-${month}-${day}`;
          break;
        } catch (e) {
          console.error('Date parsing error:', e);
        }
      }
    }

    const itemPattern = /(.+?)\s+\$?\s*([\d,]+\.?\d{0,2})/g;
    let match;
    while ((match = itemPattern.exec(text)) !== null) {
      const description = match[1].trim();
      const amount = parseFloat(match[2].replace(',', ''));
      
      if (description.length > 3 && amount > 0 && amount < 10000) {
        data.lineItems.push({
          description: description.substring(0, 100),
          quantity: 1,
          unitPrice: amount,
          amount: amount
        });
      }
    }

    data.lineItems = data.lineItems.slice(0, 10);

    if (data.merchantName) {
      data.description = `Expense at ${data.merchantName}`;
    }

    return data;
  };

  const addLineItem = () => {
    setFormData(prev => ({
      ...prev,
      lineItems: [...prev.lineItems, { description: '', quantity: 1, unitPrice: 0, amount: 0 }]
    }));
  };

  const removeLineItem = (index) => {
    setFormData(prev => ({
      ...prev,
      lineItems: prev.lineItems.filter((_, i) => i !== index)
    }));
  };

  const updateLineItem = (index, field, value) => {
    setFormData(prev => {
      const newLineItems = [...prev.lineItems];
      newLineItems[index][field] = value;
      
      if (field === 'quantity' || field === 'unitPrice') {
        newLineItems[index].amount = newLineItems[index].quantity * newLineItems[index].unitPrice;
      }
      
      return { ...prev, lineItems: newLineItems };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('amount', formData.amount);
      formDataToSend.append('currency', formData.currency);
      formDataToSend.append('categoryId', formData.categoryId);
      formDataToSend.append('description', formData.description);
      formDataToSend.append('expenseDate', formData.expenseDate);
      formDataToSend.append('merchantName', formData.merchantName);
      formDataToSend.append('lineItems', JSON.stringify(formData.lineItems));
      
      if (receiptFile) {
        formDataToSend.append('receipt', receiptFile);
      }

      await axios.post('/expenses', formDataToSend, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      alert('Expense submitted successfully!');
      navigate('/expenses');

    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit expense');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-4 py-6 max-w-4xl mx-auto">
      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className={`flex items-center ${currentStep >= 1 ? 'text-blue-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              currentStep >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-200'
            }`}>
              1
            </div>
            <span className="ml-2 text-sm font-medium">Upload Receipt</span>
          </div>
          <div className="flex-1 h-0.5 mx-4 bg-gray-200"></div>
          <div className={`flex items-center ${currentStep >= 2 ? 'text-blue-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              currentStep >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-200'
            }`}>
              2
            </div>
            <span className="ml-2 text-sm font-medium">Enter Details</span>
          </div>
          <div className="flex-1 h-0.5 mx-4 bg-gray-200"></div>
          <div className={`flex items-center ${currentStep >= 3 ? 'text-blue-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              currentStep >= 3 ? 'bg-blue-600 text-white' : 'bg-gray-200'
            }`}>
              3
            </div>
            <span className="ml-2 text-sm font-medium">Review & Submit</span>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Submit Expense</h2>

        {error && (
          <div className="bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {/* Step 1: Receipt Upload */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload Receipt (Optional - with OCR)
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                {previewUrl ? (
                  <div className="space-y-4">
                    <img src={previewUrl} alt="Receipt preview" className="mx-auto h-48 w-auto rounded" />
                    <div className="flex justify-center gap-3">
                      <label className="cursor-pointer px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
                        Change Receipt
                        <input
                          type="file"
                          className="hidden"
                          accept="image/*,.pdf"
                          onChange={handleFileChange}
                        />
                      </label>
                    </div>
                  </div>
                ) : (
                  <div>
                    <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                      <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <div className="mt-4">
                      <label className="cursor-pointer text-blue-600 hover:text-blue-700 font-medium">
                        Upload a receipt
                        <input
                          type="file"
                          className="hidden"
                          accept="image/*,.pdf"
                          onChange={handleFileChange}
                        />
                      </label>
                      <p className="mt-2 text-sm text-gray-500">or drag and drop</p>
                      <p className="text-xs text-gray-500 mt-1">PNG, JPG, PDF up to 5MB</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {receiptFile && (
              <button
                type="button"
                onClick={processOCR}
                disabled={ocrProcessing}
                className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
              >
                {ocrProcessing ? `Processing OCR... ${ocrProgress}%` : '🔍 Extract Data from Receipt (OCR)'}
              </button>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => navigate('/expenses')}
                className="flex-1 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Skip & Enter Manually
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Expense Details */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount *</label>
                <input
                  type="number"
                  step="0.01"
                  name="amount"
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  value={formData.amount}
                  onChange={handleChange}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Currency *</label>
                <select
                  name="currency"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  value={formData.currency}
                  onChange={handleChange}
                >
                  {currencies.map(curr => (
                    <option key={curr} value={curr}>{curr}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                <select
                  name="categoryId"
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  value={formData.categoryId}
                  onChange={handleChange}
                >
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                <input
                  type="date"
                  name="expenseDate"
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  value={formData.expenseDate}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Merchant Name</label>
              <input
                type="text"
                name="merchantName"
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                value={formData.merchantName}
                onChange={handleChange}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
              <textarea
                name="description"
                rows="3"
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                value={formData.description}
                onChange={handleChange}
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-3">
                <label className="block text-sm font-medium text-gray-700">Line Items (Optional)</label>
                <button
                  type="button"
                  onClick={addLineItem}
                  className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
                >
                  + Add Item
                </button>
              </div>

              {formData.lineItems.map((item, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 mb-2">
                  <input
                    type="text"
                    placeholder="Description"
                    className="col-span-6 border border-gray-300 rounded-lg px-3 py-2"
                    value={item.description}
                    onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                  />
                  <input
                    type="number"
                    placeholder="Qty"
                    className="col-span-2 border border-gray-300 rounded-lg px-3 py-2"
                    value={item.quantity}
                    onChange={(e) => updateLineItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                  />
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Price"
                    className="col-span-2 border border-gray-300 rounded-lg px-3 py-2"
                    value={item.unitPrice}
                    onChange={(e) => updateLineItem(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                  />
                  <div className="col-span-1 flex items-center">
                    <span className="text-sm text-gray-600">${item.amount.toFixed(2)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeLineItem(index)}
                    className="col-span-1 text-red-600 hover:text-red-800"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Review
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Review & Submit */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div className="bg-gray-50 rounded-lg p-6 space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Review Your Expense</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Amount</p>
                  <p className="text-xl font-bold text-gray-900">
                    {formData.currency} {parseFloat(formData.amount).toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Date</p>
                  <p className="text-base font-medium text-gray-900">
                    {new Date(formData.expenseDate).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Category</p>
                  <p className="text-base font-medium text-gray-900">
                    {categories.find(c => c.id === parseInt(formData.categoryId))?.name}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Merchant</p>
                  <p className="text-base font-medium text-gray-900">
                    {formData.merchantName || 'N/A'}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-sm text-gray-500 mb-1">Description</p>
                <p className="text-base text-gray-900">{formData.description}</p>
              </div>

              {formData.lineItems.length > 0 && (
                <div>
                  <p className="text-sm text-gray-500 mb-2">Line Items</p>
                  <div className="space-y-1">
                    {formData.lineItems.map((item, index) => (
                      <div key={index} className="flex justify-between text-sm">
                        <span>{item.description} (x{item.quantity})</span>
                        <span className="font-medium">${item.amount.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {receiptFile && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                  </svg>
                  Receipt attached: {receiptFile.name}
                </div>
              )}
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-900">
                <strong>Note:</strong> Once submitted, your expense will be sent for approval according to company policies.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
              >
                {loading ? 'Submitting...' : 'Submit Expense'}
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}

export default SubmitExpense;