import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { blogArticlesApi, blogCategoriesApi, BlogArticle, BlogCategory } from '@/api/blog';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { 
  Calendar, 
  Clock, 
  Search, 
  Tag, 
  User, 
  Eye, 
  ChevronRight,
  BookOpen,
  TrendingUp,
  Filter
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { FullPageLoader } from '@/components/ui/page-loader';
import { BrandedErrorFallback } from '@/components/error/BrandedErrorFallback';

// Settings interface for blog configuration
interface BlogSettings {
  blog_title?: string;
  blog_subtitle?: string;
  blog_description?: string;
  blog_banner_url?: string;
  blog_posts_per_page?: string;
  blog_enable_categories?: string;
  blog_enable_search?: string;
  blog_enable_featured?: string;
  blog_meta_title?: string;
  blog_meta_description?: string;
}

const Blog: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);

  // Fetch blog settings from content management
  const { data: blogSettings } = useQuery({
    queryKey: ['blog-settings'],
    queryFn: async (): Promise<BlogSettings> => {
      const { data, error } = await supabase
        .from('content_management')
        .select('key, content')
        .like('key', 'blog_%');
      
      if (error) throw error;
      
      // Convert array of settings to object
      const settings: BlogSettings = {};
      data?.forEach(item => {
        const key = item.key.replace('blog_', '');
        if (key in settings) {
          (settings as any)[key] = item.content;
        }
      });
      
      return settings;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch business settings for fallback data
  const { data: businessSettings } = useQuery({
    queryKey: ['business-settings-blog'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('business_settings')
        .select('name, tagline, seo_title, seo_description')
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();
      
      if (error) throw error;
      return data;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  // Fetch blog categories
  const { data: categories, isLoading: categoriesLoading } = useQuery({
    queryKey: ['blog-categories'],
    queryFn: () => blogCategoriesApi.getAll(),
    staleTime: 10 * 60 * 1000,
  });

  // Fetch blog articles with filters
  const { data: articles, isLoading: articlesLoading, error: articlesError } = useQuery({
    queryKey: ['blog-articles', selectedCategory, searchQuery, currentPage],
    queryFn: async () => {
      let query = supabase
        .from('blog_articles')
        .select(`
          *,
          blog_categories (
            id,
            name,
            slug
          )
        `)
        .eq('status', 'published');

      // Apply category filter
      if (selectedCategory !== 'all') {
        query = query.eq('category_id', selectedCategory);
      }

      // Apply search filter
      if (searchQuery) {
        query = query.or(`title.ilike.%${searchQuery}%, content.ilike.%${searchQuery}%, excerpt.ilike.%${searchQuery}%`);
      }

      // Apply pagination
      const postsPerPage = blogSettings?.blog_posts_per_page ? parseInt(blogSettings.blog_posts_per_page) : 10;
      const from = (currentPage - 1) * postsPerPage;
      const to = from + postsPerPage - 1;

      query = query
        .order('published_at', { ascending: false })
        .range(from, to);

      const { data, error } = await query;
      if (error) throw error;
      return data as BlogArticle[];
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    enabled: !!(blogSettings || searchQuery || selectedCategory),
  });

  // Get featured articles
  const { data: featuredArticles } = useQuery({
    queryKey: ['featured-blog-articles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('blog_articles')
        .select(`
          *,
          blog_categories (
            id,
            name,
            slug
          )
        `)
        .eq('status', 'published')
        .order('view_count', { ascending: false })
        .limit(3);

      if (error) throw error;
      return data as BlogArticle[];
    },
    staleTime: 15 * 60 * 1000, // 15 minutes
    enabled: blogSettings?.blog_enable_featured !== 'false',
  });

  // Derived values for UI
  const blogTitle = blogSettings?.blog_title || businessSettings?.name + ' Blog' || 'Our Blog';
  const blogSubtitle = blogSettings?.blog_subtitle || businessSettings?.tagline || 'Stay updated with our latest news and insights';
  const blogDescription = blogSettings?.blog_description || 'Discover the latest updates, insights, and stories from our team.';
  const metaTitle = blogSettings?.blog_meta_title || blogSettings?.blog_title || businessSettings?.seo_title || blogTitle;
  const metaDescription = blogSettings?.blog_meta_description || blogDescription;

  // Filter articles based on search and category
  const filteredArticles = useMemo(() => {
    if (!articles) return [];
    return articles;
  }, [articles]);

  const handleCategoryChange = (categoryId: string) => {
    setSelectedCategory(categoryId);
    setCurrentPage(1);
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
  };

  // Loading states
  if (categoriesLoading || articlesLoading) {
    return <FullPageLoader message="Loading blog content..." />;
  }

  // Error state
  if (articlesError) {
    return (
      <BrandedErrorFallback 
        error={articlesError} 
      />
    );
  }

  return (
    <>
      <Helmet>
        <title>{metaTitle}</title>
        <meta name="description" content={metaDescription} />
        <meta property="og:title" content={metaTitle} />
        <meta property="og:description" content={metaDescription} />
        <meta property="og:type" content="website" />
        {blogSettings?.blog_banner_url && (
          <meta property="og:image" content={blogSettings.blog_banner_url} />
        )}
        <meta name="keywords" content="blog, news, updates, articles, insights" />
        <link rel="canonical" href={`${window.location.origin}/blog`} />
      </Helmet>

      <div className="min-h-screen bg-background">
        {/* Hero Section */}
        <section className="bg-gradient-to-br from-primary to-primary-variant text-primary-foreground py-16 px-4">
          <div className="container mx-auto max-w-4xl text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              {blogTitle}
            </h1>
            <p className="text-xl md:text-2xl mb-6 opacity-90">
              {blogSubtitle}
            </p>
            <p className="text-lg opacity-80 max-w-2xl mx-auto">
              {blogDescription}
            </p>
          </div>
        </section>

        {/* Content Section */}
        <section className="py-12 px-4">
          <div className="container mx-auto max-w-6xl">
            
            {/* Featured Articles */}
            {blogSettings?.blog_enable_featured !== 'false' && featuredArticles && featuredArticles.length > 0 && (
              <div className="mb-12">
                <div className="flex items-center gap-2 mb-6">
                  <TrendingUp className="h-6 w-6 text-primary" />
                  <h2 className="text-2xl font-bold">Featured Articles</h2>
                </div>
                <div className="grid md:grid-cols-3 gap-6">
                  {featuredArticles.map((article) => (
                    <Card key={article.id} className="group hover:shadow-lg transition-shadow">
                      {article.featured_image_url && (
                        <div className="relative overflow-hidden rounded-t-lg">
                          <img 
                            src={article.featured_image_url} 
                            alt={article.title}
                            className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          {article.blog_categories && (
                            <Badge className="absolute top-3 left-3">
                              {article.blog_categories.name}
                            </Badge>
                          )}
                        </div>
                      )}
                      <CardHeader>
                        <h3 className="font-semibold line-clamp-2 group-hover:text-primary transition-colors">
                          {article.title}
                        </h3>
                        {article.excerpt && (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {article.excerpt}
                          </p>
                        )}
                      </CardHeader>
                      <CardFooter className="pt-0">
                        <div className="flex items-center justify-between w-full text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDistanceToNow(new Date(article.published_at || article.created_at))} ago
                          </div>
                          <div className="flex items-center gap-1">
                            <Eye className="h-3 w-3" />
                            {article.view_count}
                          </div>
                        </div>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
                <Separator className="mt-12" />
              </div>
            )}

            {/* Search and Filters */}
            <div className="mb-8">
              <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-6 w-6 text-primary" />
                  <h2 className="text-2xl font-bold">All Articles</h2>
                </div>
                
                {blogSettings?.blog_enable_search !== 'false' && (
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search articles..."
                      value={searchQuery}
                      onChange={(e) => handleSearchChange(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                )}
              </div>

              {/* Category Filter */}
              {blogSettings?.blog_enable_categories !== 'false' && categories && categories.length > 0 && (
                <div className="mt-4">
                  <Tabs value={selectedCategory} onValueChange={handleCategoryChange}>
                    <TabsList className="w-full justify-start overflow-x-auto">
                      <TabsTrigger value="all" className="flex items-center gap-2">
                        <Filter className="h-4 w-4" />
                        All Categories
                      </TabsTrigger>
                      {categories.filter(cat => cat.is_active).map((category) => (
                        <TabsTrigger key={category.id} value={category.id}>
                          {category.name}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
                </div>
              )}
            </div>

            {/* Articles Grid */}
            {filteredArticles && filteredArticles.length > 0 ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredArticles.map((article) => (
                  <Card key={article.id} className="group hover:shadow-lg transition-shadow h-fit">
                    {article.featured_image_url && (
                      <div className="relative overflow-hidden rounded-t-lg">
                        <img 
                          src={article.featured_image_url} 
                          alt={article.title}
                          className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        {article.blog_categories && (
                          <Badge className="absolute top-3 left-3">
                            {article.blog_categories.name}
                          </Badge>
                        )}
                      </div>
                    )}
                    <CardHeader>
                      <h3 className="font-semibold line-clamp-2 group-hover:text-primary transition-colors">
                        {article.title}
                      </h3>
                      {article.excerpt && (
                        <p className="text-sm text-muted-foreground line-clamp-3">
                          {article.excerpt}
                        </p>
                      )}
                    </CardHeader>
                    <CardContent className="pt-0">
                      {article.tags && article.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {article.tags.slice(0, 3).map((tag, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              <Tag className="h-2 w-2 mr-1" />
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </CardContent>
                    <CardFooter className="pt-0">
                      <div className="flex items-center justify-between w-full text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDistanceToNow(new Date(article.published_at || article.created_at))} ago
                        </div>
                        <div className="flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          {article.view_count}
                        </div>
                      </div>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <BookOpen className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">No articles found</h3>
                <p className="text-muted-foreground mb-6">
                  {searchQuery || selectedCategory !== 'all' 
                    ? 'Try adjusting your search or filter criteria.' 
                    : 'Check back soon for new content!'}
                </p>
                {(searchQuery || selectedCategory !== 'all') && (
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedCategory('all');
                    }}
                  >
                    Clear Filters
                  </Button>
                )}
              </div>
            )}

            {/* Pagination could be added here if needed */}
          </div>
        </section>
      </div>
    </>
  );
};

export default Blog;