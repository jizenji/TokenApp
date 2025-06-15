
'use client';

import type { PromotionData } from '@/types';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { ExternalLink } from 'lucide-react';

interface PromotionCardProps {
  promotion: PromotionData;
}

export function PromotionCard({ promotion }: PromotionCardProps) {
  const content = (
    <div className="relative aspect-[3/1] w-full overflow-hidden rounded-lg group">
      <Image
        src={promotion.imageUrl}
        alt={promotion.altText}
        fill
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        className="object-cover transition-transform duration-300 ease-in-out group-hover:scale-105"
        data-ai-hint="promotion banner" // Generic hint for now
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-4 flex flex-col justify-end">
        <p className="text-primary-foreground font-semibold text-lg drop-shadow-md">{promotion.altText}</p>
      </div>
      {promotion.linkUrl && (
        <div className="absolute top-2 right-2 bg-background/80 text-foreground p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <ExternalLink className="h-4 w-4" />
        </div>
      )}
    </div>
  );

  if (promotion.linkUrl) {
    return (
      <Link href={promotion.linkUrl} target="_blank" rel="noopener noreferrer" className="block no-underline">
        <Card className="overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300">
          <CardContent className="p-0">
            {content}
          </CardContent>
        </Card>
      </Link>
    );
  }

  return (
    <Card className="overflow-hidden shadow-lg">
      <CardContent className="p-0">
        {content}
      </CardContent>
    </Card>
  );
}
