import { SearchQueryDto } from '../dto/search-query.dto';
import { SearchResult } from './search-result.interface';

export interface ISearchStrategy {
  searchPets(dto: SearchQueryDto): Promise<SearchResult>;
  searchVets(dto: SearchQueryDto): Promise<SearchResult>;
  searchMedicalRecords(dto: SearchQueryDto): Promise<SearchResult>;
  autocomplete(query: string, type?: string): Promise<string[]>;
}
