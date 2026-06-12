import { Module } from '@nestjs/common';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { LinksModule } from '../links/links.module';
import { McpController } from './mcp.controller';
import { PUBLIC_BASE_URL_TOKEN } from './mcp.constants';

export { PUBLIC_BASE_URL_TOKEN } from './mcp.constants';

@Module({
  imports: [ApiKeysModule, LinksModule],
  providers: [
    {
      provide: PUBLIC_BASE_URL_TOKEN,
      useFactory: (): string => {
        const raw = process.env['PUBLIC_BASE_URL'] ?? 'https://mikrou.li';
        return raw.replace(/\/$/, '');
      },
    },
  ],
  controllers: [McpController],
})
export class McpModule {}
