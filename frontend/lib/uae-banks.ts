/**
 * قائمة بنوك الإمارات - UAE Banks list
 * للاستخدام في حقل "اسم البنك" عند إضافة/تعديل البطاقات
 */
export const UAE_BANKS = [
  'Abu Dhabi Commercial Bank (ADCB)',
  'Abu Dhabi Islamic Bank (ADIB)',
  'Ajman Bank',
  'Al Hilal Bank',
  'Al Maryah Community Bank',
  'Bank of Baroda',
  'Bank of Sharjah',
  'Commercial Bank of Dubai (CBD)',
  'Commercial Bank International (CBI)',
  'Dubai Islamic Bank (DIB)',
  'Emirates NBD',
  'Emirates Islamic',
  'Emirates Investment Bank',
  'First Abu Dhabi Bank (FAB)',
  'Habib Bank',
  'HSBC Bank Middle East',
  'Invest Bank',
  'Mashreq Bank',
  'National Bank of Fujairah (NBF)',
  'RAK Bank (National Bank of Ras Al Khaimah)',
  'Standard Chartered UAE',
  'United Arab Bank (UAB)',
  'Arab Bank',
  'Citibank UAE',
  'Barclays Bank UAE',
  'Deutsche Bank',
  'Mashreq Al Islami',
  'Noor Bank',
  'Warba Bank',
] as const;

export type UAEBankName = (typeof UAE_BANKS)[number];
