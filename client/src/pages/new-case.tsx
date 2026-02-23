import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { US_STATES } from "@/lib/stateLaws";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Shield, ArrowLeft, ArrowRight, MapPin, Calendar, DollarSign, User, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/theme-provider";
import { usePageTitle } from "@/hooks/use-page-title";

const caseFormSchema = z.object({
  state: z.string().min(1, "Please select a state"),
  moveOutDate: z.string().min(1, "Move-out date is required"),
  depositAmount: z.string().min(1, "Deposit amount is required").refine(
    (val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0,
    "Must be a positive number"
  ),
  amountReturned: z.string().default("0"),
  tenantName: z.string().min(1, "Your name is required"),
  tenantAddress: z.string().min(1, "Your current address is required"),
  landlordName: z.string().min(1, "Landlord name is required"),
  landlordAddress: z.string().min(1, "Landlord address is required"),
  propertyAddress: z.string().min(1, "Rental property address is required"),
  tenancyStart: z.string().optional(),
});

type CaseFormValues = z.infer<typeof caseFormSchema>;

export default function NewCasePage() {
  const [, navigate] = useLocation();
  const [step, setStep] = useState(1);
  const { toast } = useToast();
  usePageTitle("Start Your Security Deposit Case — Free Analysis", "Start your free security deposit recovery case. Enter your state, deposit amount, and move-out date to instantly detect landlord violations and calculate penalties under your state's law.");

  const form = useForm<CaseFormValues>({
    resolver: zodResolver(caseFormSchema),
    defaultValues: {
      state: "",
      moveOutDate: "",
      depositAmount: "",
      amountReturned: "0",
      tenantName: "",
      tenantAddress: "",
      landlordName: "",
      landlordAddress: "",
      propertyAddress: "",
      tenancyStart: "",
    },
  });

  const createCase = useMutation({
    mutationFn: async (data: CaseFormValues) => {
      const res = await apiRequest("POST", "/api/cases", {
        state: data.state,
        moveOutDate: data.moveOutDate,
        depositAmount: data.depositAmount,
        amountReturned: data.amountReturned || "0",
        tenantName: data.tenantName,
        tenantAddress: data.tenantAddress,
        landlordName: data.landlordName,
        landlordAddress: data.landlordAddress,
        propertyAddress: data.propertyAddress,
        tenancyStart: data.tenancyStart || null,
      });
      return res.json();
    },
    onSuccess: (data) => {
      navigate(`/cases/${data.accessToken}`);
    },
    onError: (err: Error) => {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CaseFormValues) => {
    createCase.mutate(data);
  };

  const canProceedToStep2 = () => {
    const values = form.getValues();
    return values.state && values.moveOutDate && values.depositAmount && parseFloat(values.depositAmount) > 0;
  };

  const canProceedToStep3 = () => {
    const values = form.getValues();
    return values.tenantName && values.tenantAddress && values.propertyAddress;
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-2">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-muted-foreground hover-elevate rounded-md px-2 py-1"
            data-testid="button-back-home"
          >
            <ArrowLeft className="h-4 w-4" />
            <Shield className="h-5 w-5 text-[#2E5FAA]" />
            <span className="font-serif text-sm font-bold text-foreground">TenantAdvocate</span>
          </button>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-2 w-8 rounded-full transition-colors ${
                  s <= step ? "bg-[#2E5FAA]" : "bg-muted"
                }`}
              />
            ))}
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            {step === 1 && (
              <div>
                <div className="mb-8">
                  <h1 className="font-serif text-2xl sm:text-3xl font-bold text-foreground mb-2">
                    Tell us about your deposit
                  </h1>
                  <p className="text-muted-foreground">
                    We'll check your state's laws and calculate what you may be owed.
                  </p>
                </div>

                <div className="space-y-6">
                  <FormField
                    control={form.control}
                    name="state"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-[#2E5FAA]" />
                          State where you rented
                        </FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-state">
                              <SelectValue placeholder="Select your state" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {US_STATES.map((s) => (
                              <SelectItem key={s.value} value={s.value}>
                                {s.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="moveOutDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-[#2E5FAA]" />
                          When did you move out?
                        </FormLabel>
                        <FormControl>
                          <Input type="date" data-testid="input-move-out-date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="depositAmount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <DollarSign className="h-4 w-4 text-[#2E5FAA]" />
                            Deposit amount
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="2500.00"
                              data-testid="input-deposit-amount"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="amountReturned"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                            Amount returned
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              data-testid="input-amount-returned"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="tenancyStart"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          When did your tenancy start? (optional)
                        </FormLabel>
                        <FormControl>
                          <Input type="date" data-testid="input-tenancy-start" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="mt-8 flex justify-end">
                  <Button
                    type="button"
                    data-testid="button-next-step-1"
                    onClick={() => canProceedToStep2() ? setStep(2) : form.trigger(["state", "moveOutDate", "depositAmount"])}
                  >
                    Continue
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div>
                <div className="mb-8">
                  <h1 className="font-serif text-2xl sm:text-3xl font-bold text-foreground mb-2">
                    Your information
                  </h1>
                  <p className="text-muted-foreground">
                    This will appear on the demand letter sent to your landlord.
                  </p>
                </div>

                <div className="space-y-6">
                  <FormField
                    control={form.control}
                    name="tenantName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <User className="h-4 w-4 text-[#2E5FAA]" />
                          Your full name
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="Jane Smith" data-testid="input-tenant-name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="tenantAddress"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-[#2E5FAA]" />
                          Your current mailing address
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="123 New St, City, State ZIP" data-testid="input-tenant-address" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="propertyAddress"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-[#2E5FAA]" />
                          Rental property address
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="789 Rental St, City, State ZIP" data-testid="input-property-address" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="mt-8 flex justify-between">
                  <Button type="button" variant="outline" onClick={() => setStep(1)} data-testid="button-back-step-2">
                    <ArrowLeft className="mr-1 h-4 w-4" />
                    Back
                  </Button>
                  <Button
                    type="button"
                    data-testid="button-next-step-2"
                    onClick={() => canProceedToStep3() ? setStep(3) : form.trigger(["tenantName", "tenantAddress", "propertyAddress"])}
                  >
                    Continue
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div>
                <div className="mb-8">
                  <h1 className="font-serif text-2xl sm:text-3xl font-bold text-foreground mb-2">
                    Landlord information
                  </h1>
                  <p className="text-muted-foreground">
                    The demand letter will be addressed to your landlord.
                  </p>
                </div>

                <div className="space-y-6">
                  <FormField
                    control={form.control}
                    name="landlordName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <User className="h-4 w-4 text-[#2E5FAA]" />
                          Landlord / property manager name
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="Bob Johnson" data-testid="input-landlord-name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="landlordAddress"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-[#2E5FAA]" />
                          Landlord mailing address
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="456 Landlord Ave, City, State ZIP" data-testid="input-landlord-address" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="mt-8 flex justify-between">
                  <Button type="button" variant="outline" onClick={() => setStep(2)} data-testid="button-back-step-3">
                    <ArrowLeft className="mr-1 h-4 w-4" />
                    Back
                  </Button>
                  <Button
                    type="submit"
                    data-testid="button-submit-case"
                    disabled={createCase.isPending}
                    className="bg-[#C9A84C] text-white border-[#b8963f]"
                  >
                    {createCase.isPending ? "Creating..." : "Analyze My Case"}
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </form>
        </Form>
      </div>
    </div>
  );
}
