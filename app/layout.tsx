import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Comic Generator',
  description: '根据故事文本生成多格漫画脚本与画面提示词。'
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
