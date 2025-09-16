import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  BookOpen, 
  Target, 
  TrendingUp, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle,
  Percent,
  DollarSign,
  Gift,
  Truck,
  Users,
  Clock,
  BarChart3
} from 'lucide-react';

export function PromotionGuidelinesSection() {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold flex items-center justify-center gap-2">
          <BookOpen className="w-6 h-6 text-blue-600" />
          Promotion Management Guide
        </h2>
        <p className="text-muted-foreground">
          Complete guide to creating effective promotions that drive sales and customer satisfaction
        </p>
      </div>

      <Tabs defaultValue="types" className="w-full">
        <TabsList className="grid grid-cols-2 md:grid-cols-4 w-full">
          <TabsTrigger value="types">Promotion Types</TabsTrigger>
          <TabsTrigger value="strategy">Strategy</TabsTrigger>
          <TabsTrigger value="best-practices">Best Practices</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="types" className="mt-6 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="border-green-200 bg-green-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-800">
                  <Percent className="w-5 h-5" />
                  Percentage Discount
                </CardTitle>
                <CardDescription>Most popular and flexible discount type</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <h4 className="font-semibold mb-2">When to Use:</h4>
                  <ul className="text-sm space-y-1 text-green-700">
                    <li>• General sales and seasonal promotions</li>
                    <li>• Clearing old inventory</li>
                    <li>• Customer acquisition campaigns</li>
                    <li>• Category-specific promotions</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Recommended Values:</h4>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">5-15% (Regular)</Badge>
                    <Badge variant="outline">20-30% (Sale)</Badge>
                    <Badge variant="outline">40-60% (Clearance)</Badge>
                  </div>
                </div>
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Always set a maximum discount amount to control costs on high-value orders
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            <Card className="border-blue-200 bg-blue-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-800">
                  <DollarSign className="w-5 h-5" />
                  Fixed Amount Discount
                </CardTitle>
                <CardDescription>Fixed monetary discount in Naira</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <h4 className="font-semibold mb-2">When to Use:</h4>
                  <ul className="text-sm space-y-1 text-blue-700">
                    <li>• First-time customer offers</li>
                    <li>• Loyalty rewards</li>
                    <li>• Minimum order incentives</li>
                    <li>• Simple promotional campaigns</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Common Amounts:</h4>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">₦100-₦250</Badge>
                    <Badge variant="outline">₦500-₦1000</Badge>
                    <Badge variant="outline">₦1500-₦2500</Badge>
                  </div>
                </div>
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    Always require minimum order 3-5x the discount amount
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            <Card className="border-purple-200 bg-purple-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-purple-800">
                  <Gift className="w-5 h-5" />
                  Buy One Get One (BOGO)
                </CardTitle>
                <CardDescription>Increase order quantity and clear inventory</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <h4 className="font-semibold mb-2">When to Use:</h4>
                  <ul className="text-sm space-y-1 text-purple-700">
                    <li>• Boost order volume</li>
                    <li>• Clear slow-moving products</li>
                    <li>• Introduce new products</li>
                    <li>• Bundle complementary items</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">BOGO Variations:</h4>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">100% (Free)</Badge>
                    <Badge variant="outline">50% (Half Price)</Badge>
                    <Badge variant="outline">25% (Quarter Off)</Badge>
                  </div>
                </div>
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Monitor inventory levels carefully - BOGO can deplete stock quickly
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            <Card className="border-orange-200 bg-orange-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-orange-800">
                  <Truck className="w-5 h-5" />
                  Free Delivery
                </CardTitle>
                <CardDescription>Remove delivery barriers to increase conversions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <h4 className="font-semibold mb-2">When to Use:</h4>
                  <ul className="text-sm space-y-1 text-orange-700">
                    <li>• Increase average order value</li>
                    <li>• Competitive advantage</li>
                    <li>• Customer retention</li>
                    <li>• Geographic expansion</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Threshold Recommendations:</h4>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">₦2000 (Low AOV)</Badge>
                    <Badge variant="outline">₦3000 (Medium AOV)</Badge>
                    <Badge variant="outline">₦5000+ (High AOV)</Badge>
                  </div>
                </div>
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    Set threshold slightly below your average order value
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="strategy" className="mt-6 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-red-500" />
                  Promotion Strategy
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Customer Acquisition</h4>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li>• First-time buyer: 10-15% off or ₦500 off ₦3000+</li>
                    <li>• Social media followers: Exclusive codes</li>
                    <li>• Referral programs: Both parties benefit</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Customer Retention</h4>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li>• Loyalty tiers: Increasing benefits</li>
                    <li>• Birthday/anniversary offers</li>
                    <li>• Repeat purchase incentives</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Inventory Management</h4>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li>• Seasonal clearance: 30-50% off</li>
                    <li>• BOGO for slow movers</li>
                    <li>• Bundle deals for complementary items</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-blue-500" />
                  Timing & Duration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Promotion Duration</h4>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li>• Flash sales: 24-48 hours</li>
                    <li>• Weekend specials: Friday-Sunday</li>
                    <li>• Seasonal: 1-2 weeks</li>
                    <li>• Clearance: Until stock lasts</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Optimal Timing</h4>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li>• Payday periods: 25th-30th, 1st-5th</li>
                    <li>• Weekends: Higher engagement</li>
                    <li>• Holidays: Plan 2-3 weeks ahead</li>
                    <li>• End of month: Inventory clearing</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Frequency Guidelines</h4>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li>• Major sales: Monthly maximum</li>
                    <li>• Small promotions: Weekly okay</li>
                    <li>• Avoid promotion fatigue</li>
                    <li>• Maintain pricing integrity</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="best-practices" className="mt-6 space-y-4">
          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-green-500" />
                  Best Practices & Guidelines
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2 text-green-600">
                      <CheckCircle className="w-4 h-4" />
                      Do's
                    </h4>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start gap-2">
                        <span className="text-green-500 mt-0.5">✓</span>
                        Set clear terms and conditions
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-500 mt-0.5">✓</span>
                        Use compelling promotion names
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-500 mt-0.5">✓</span>
                        Monitor usage and performance
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-500 mt-0.5">✓</span>
                        Set reasonable usage limits
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-500 mt-0.5">✓</span>
                        Test with small audiences first
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-500 mt-0.5">✓</span>
                        Combine with marketing campaigns
                      </li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2 text-red-600">
                      <AlertTriangle className="w-4 h-4" />
                      Don'ts
                    </h4>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start gap-2">
                        <span className="text-red-500 mt-0.5">✗</span>
                        Run too many promotions simultaneously
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-red-500 mt-0.5">✗</span>
                        Offer unsustainable discounts
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-red-500 mt-0.5">✗</span>
                        Forget to set end dates
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-red-500 mt-0.5">✗</span>
                        Ignore inventory levels for BOGO
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-red-500 mt-0.5">✗</span>
                        Make terms overly complex
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-red-500 mt-0.5">✗</span>
                        Devalue your brand with constant sales
                      </li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-purple-500" />
                  Promotion Code Best Practices
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <h4 className="font-semibold mb-2">Code Format</h4>
                    <ul className="text-sm space-y-1 text-muted-foreground">
                      <li>• Keep it short (6-8 characters)</li>
                      <li>• Use memorable words</li>
                      <li>• Avoid confusing characters (0/O, 1/l)</li>
                      <li>• Make it brand-relevant</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Examples</h4>
                    <div className="space-y-1">
                      <Badge variant="outline">SAVE20</Badge>
                      <Badge variant="outline">FIRST500</Badge>
                      <Badge variant="outline">WEEKEND</Badge>
                      <Badge variant="outline">FREESHIP</Badge>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Security</h4>
                    <ul className="text-sm space-y-1 text-muted-foreground">
                      <li>• Set usage limits</li>
                      <li>• Monitor for abuse</li>
                      <li>• Use unique codes for high-value offers</li>
                      <li>• Expire inactive codes</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="mt-6 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-500" />
                Key Metrics to Track
              </CardTitle>
              <CardDescription>
                Monitor these metrics to optimize your promotion performance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <h4 className="font-semibold mb-3">Performance Metrics</h4>
                  <div className="space-y-3">
                    <div className="p-3 border rounded-lg">
                      <div className="font-medium">Usage Rate</div>
                      <div className="text-sm text-muted-foreground">
                        Track how many customers actually use your promotions
                      </div>
                    </div>
                    <div className="p-3 border rounded-lg">
                      <div className="font-medium">Conversion Impact</div>
                      <div className="text-sm text-muted-foreground">
                        Compare conversion rates with and without promotions
                      </div>
                    </div>
                    <div className="p-3 border rounded-lg">
                      <div className="font-medium">Average Order Value</div>
                      <div className="text-sm text-muted-foreground">
                        Monitor if promotions increase or decrease AOV
                      </div>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold mb-3">Business Impact</h4>
                  <div className="space-y-3">
                    <div className="p-3 border rounded-lg">
                      <div className="font-medium">Revenue Impact</div>
                      <div className="text-sm text-muted-foreground">
                        Calculate total revenue attributed to promotions
                      </div>
                    </div>
                    <div className="p-3 border rounded-lg">
                      <div className="font-medium">Customer Acquisition</div>
                      <div className="text-sm text-muted-foreground">
                        Track new customers acquired through promotions
                      </div>
                    </div>
                    <div className="p-3 border rounded-lg">
                      <div className="font-medium">Margin Analysis</div>
                      <div className="text-sm text-muted-foreground">
                        Ensure promotions don't erode profitability
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}