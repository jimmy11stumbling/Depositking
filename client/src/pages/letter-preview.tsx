import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Case, Letter, Signature } from "@shared/schema";
import DOMPurify from "dompurify";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, CheckCircle2, AlertTriangle, Eraser, Send, Loader2, FileText,
  Printer, Download, Mail, Scale, ArrowRight, Pencil, Save, X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/theme-provider";
import { Logo } from "@/components/logo";
import { usePageTitle } from "@/hooks/use-page-title";

export default function LetterPreviewPage() {
  const params = useParams<{ id: string }>();
  const caseToken = params.id;
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const letterContentRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSigned, setHasSigned] = useState(false);
  const [certified, setCertified] = useState(false);
  const [sigError, setSigError] = useState("");
  const [isDownloading, setIsDownloading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedHtml, setEditedHtml] = useState("");
  const editorRef = useRef<HTMLDivElement>(null);
  const signatureSectionRef = useRef<HTMLDivElement>(null);

  const { data: caseData, isLoading: caseLoading } = useQuery<Case>({
    queryKey: ["/api/cases", caseToken],
  });

  const caseId = caseData?.id;

  const { data: letter, isLoading: letterLoading } = useQuery<Letter>({
    queryKey: ["/api/cases", caseToken, "letter"],
    enabled: !!caseData,
  });

  const { data: signature } = useQuery<Signature>({
    queryKey: ["/api/cases", caseToken, "signature"],
    enabled: caseData?.status === "signed",
  });

  const isSigned = caseData?.status === "signed";

  usePageTitle(isSigned ? `Signed Demand Letter — Case #${caseId}` : `Review Demand Letter — Case #${caseId}`, "Review, edit, and sign your AI-generated security deposit demand letter. Download as PDF or send via USPS certified mail with tracking.");

  const sanitizedHtml = useMemo(() => {
    if (!letter?.finalHtml) return "";
    return DOMPurify.sanitize(letter.finalHtml, {
      ALLOWED_TAGS: ["p", "br", "strong", "em", "b", "i", "u", "ul", "ol", "li", "h1", "h2", "h3", "h4", "h5", "h6", "span", "div", "table", "thead", "tbody", "tr", "td", "th", "blockquote", "hr", "sup", "sub"],
      ALLOWED_ATTR: ["class", "style"],
    });
  }, [letter?.finalHtml]);

  const saveLetter = useMutation({
    mutationFn: async (finalHtml: string) => {
      const res = await apiRequest("PUT", `/api/cases/${caseToken}/letter`, { finalHtml });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Letter Saved", description: "Your changes have been saved." });
      queryClient.invalidateQueries({ queryKey: ["/api/cases", caseToken, "letter"] });
      setIsEditing(false);
    },
    onError: (err: Error) => {
      toast({ title: "Save Failed", description: err.message, variant: "destructive" });
    },
  });

  const handleStartEdit = () => {
    setEditedHtml(sanitizedHtml);
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    const content = editorRef.current?.innerHTML || "";
    if (content.length < 50) {
      toast({ title: "Too Short", description: "The letter content is too short to save.", variant: "destructive" });
      return;
    }
    saveLetter.mutate(content);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedHtml("");
  };

  const submitSignature = useMutation({
    mutationFn: async (signatureBase64: string) => {
      const res = await apiRequest("POST", `/api/cases/${caseToken}/sign`, {
        caseId,
        signatureBase64,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Letter Signed", description: "Your demand letter has been signed and finalized." });
      queryClient.invalidateQueries({ queryKey: ["/api/cases", caseToken] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  useEffect(() => {
    if (isSigned) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = canvas.offsetWidth * 2;
    canvas.height = canvas.offsetHeight * 2;
    ctx.scale(2, 2);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
    ctx.strokeStyle = "#1E3A5F";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, [letter, isSigned]);

  const getPos = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  const startDraw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    setIsDrawing(true);
    setHasSigned(true);
    setSigError("");
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  }, [getPos]);

  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  }, [isDrawing, getPos]);

  const stopDraw = useCallback(() => {
    setIsDrawing(false);
  }, []);

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
    setHasSigned(false);
  };

  const checkSignatureNotEmpty = (): boolean => {
    const canvas = canvasRef.current;
    if (!canvas) return false;
    const ctx = canvas.getContext("2d");
    if (!ctx) return false;
    const pixelData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    for (let i = 0; i < pixelData.length; i += 4) {
      if (pixelData[i] < 250 || pixelData[i + 1] < 250 || pixelData[i + 2] < 250) {
        return true;
      }
    }
    return false;
  };

  const handleSend = () => {
    if (!checkSignatureNotEmpty()) {
      setSigError("Please sign the letter before sending.");
      signatureSectionRef.current?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    if (!certified) {
      toast({
        title: "Certification Required",
        description: "Please check the certification box before proceeding.",
        variant: "destructive",
      });
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const signatureBase64 = canvas.toDataURL("image/png");
    submitSignature.mutate(signatureBase64);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    const element = letterContentRef.current;
    if (!element) return;

    setIsDownloading(true);
    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "letter");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const contentWidth = pdfWidth - margin * 2;

      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = contentWidth / imgWidth;
      const scaledHeight = imgHeight * ratio;
      const maxContentHeight = pdfHeight - margin * 2;

      if (scaledHeight <= maxContentHeight) {
        pdf.addImage(imgData, "PNG", margin, margin, contentWidth, scaledHeight);
      } else {
        let remainingHeight = imgHeight;
        let sourceY = 0;
        let page = 0;

        while (remainingHeight > 0) {
          if (page > 0) pdf.addPage();

          const sliceHeight = Math.min(remainingHeight, maxContentHeight / ratio);

          const sliceCanvas = document.createElement("canvas");
          sliceCanvas.width = imgWidth;
          sliceCanvas.height = sliceHeight;
          const sliceCtx = sliceCanvas.getContext("2d");
          if (sliceCtx) {
            sliceCtx.fillStyle = "#ffffff";
            sliceCtx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
            sliceCtx.drawImage(
              canvas,
              0, sourceY, imgWidth, sliceHeight,
              0, 0, imgWidth, sliceHeight
            );
          }

          const sliceData = sliceCanvas.toDataURL("image/png");
          pdf.addImage(sliceData, "PNG", margin, margin, contentWidth, sliceHeight * ratio);

          sourceY += sliceHeight;
          remainingHeight -= sliceHeight;
          page++;
        }
      }

      pdf.save(`demand-letter-case-${caseId}.pdf`);
      toast({ title: "Downloaded", description: "Your demand letter has been saved as a PDF." });
    } catch (err) {
      console.error("PDF generation error:", err);
      toast({ title: "Download Failed", description: "Could not generate PDF. Try using Print instead.", variant: "destructive" });
    } finally {
      setIsDownloading(false);
    }
  };

  const isLoading = caseLoading || letterLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b sticky top-0 z-50 bg-background/95 backdrop-blur">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center">
            <Skeleton className="h-6 w-48" />
          </div>
        </header>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
          <Skeleton className="h-[600px] w-full" />
        </div>
      </div>
    );
  }

  if (!letter || !letter.finalHtml) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="p-8 text-center max-w-md">
          <AlertTriangle className="h-12 w-12 text-[#C9A84C] mx-auto mb-4" />
          <h2 className="font-serif text-xl font-bold mb-2">No Letter Generated</h2>
          <p className="text-muted-foreground mb-4">You need to generate a demand letter before you can review and sign it.</p>
          <Button onClick={() => navigate(`/cases/${caseToken}/generate`)} data-testid="button-go-generate">
            Generate Letter
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/95 backdrop-blur sticky top-0 z-50 print:hidden">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-2">
          <button
            onClick={() => navigate(`/cases/${caseToken}`)}
            className="flex items-center gap-2 text-muted-foreground hover-elevate rounded-md px-2 py-1"
            data-testid="button-back-dashboard"
          >
            <ArrowLeft className="h-4 w-4" />
            <Logo size="sm" showText={false} />
            <span className="font-serif text-sm font-bold text-foreground">Back to Case</span>
          </button>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {isSigned && (
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 text-xs">
                <CheckCircle2 className="mr-1 h-3 w-3" />
                Signed
              </Badge>
            )}
            {letter.confidenceScore && (
              <Badge variant="secondary" className="text-xs" data-testid="badge-confidence">
                {letter.confidenceScore}% confidence
              </Badge>
            )}
            <Badge variant="secondary">Case #{caseId}</Badge>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        <div className="text-center mb-4 print:hidden">
          <h1 className="font-serif text-2xl font-bold text-foreground mb-1">
            {isSigned ? "Your Signed Demand Letter" : isEditing ? "Editing Your Letter" : "Review Your Demand Letter"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isSigned
              ? "Your letter is finalized. Print or download it to send to your landlord."
              : isEditing
              ? "Make your changes directly in the letter below. Click Save when done."
              : "Review the letter carefully. You can edit it before signing."}
          </p>
        </div>

        {isSigned && (
          <div className="flex flex-wrap justify-center gap-2 print:hidden">
            <Button onClick={handlePrint} data-testid="button-print-letter">
              <Printer className="mr-2 h-4 w-4" />
              Print Letter
            </Button>
            <Button
              variant="outline"
              onClick={handleDownloadPDF}
              disabled={isDownloading}
              data-testid="button-download-pdf"
            >
              {isDownloading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              {isDownloading ? "Generating PDF..." : "Download PDF"}
            </Button>
            <Button variant="outline" onClick={() => navigate(`/cases/${caseToken}`)} data-testid="button-back-to-case">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Case
            </Button>
          </div>
        )}

        {!isSigned && !isEditing && (
          <div className="flex justify-end print:hidden">
            <Button variant="outline" onClick={handleStartEdit} data-testid="button-edit-letter">
              <Pencil className="mr-2 h-4 w-4" />
              Edit Letter
            </Button>
          </div>
        )}

        {isEditing && (
          <div className="flex items-center justify-between gap-2 p-3 rounded-lg border bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 print:hidden">
            <p className="text-sm text-amber-800 dark:text-amber-200 flex items-center gap-2">
              <Pencil className="h-4 w-4" />
              You are editing the letter. Click directly in the text below to make changes.
            </p>
            <div className="flex gap-2 flex-shrink-0">
              <Button size="sm" variant="outline" onClick={handleCancelEdit} data-testid="button-cancel-edit">
                <X className="mr-1 h-3 w-3" />
                Cancel
              </Button>
              <Button size="sm" onClick={handleSaveEdit} disabled={saveLetter.isPending} data-testid="button-save-letter">
                {saveLetter.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Save className="mr-1 h-3 w-3" />}
                {saveLetter.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        )}

        <Card className={`p-6 sm:p-10 bg-white dark:bg-white text-gray-900 print:shadow-none print:border-none ${isEditing ? "ring-2 ring-amber-400 dark:ring-amber-600" : ""}`}>
          <style>{`
            .legal-letter .letter-date { font-size: 0.92rem; margin-bottom: 18px; color: #1a1a1a; }
            .legal-letter .letter-via { font-size: 0.78rem; letter-spacing: 0.06em; text-transform: uppercase; color: #444; border-left: 3px solid #1E3A5F; padding: 4px 10px; margin-bottom: 22px; font-weight: 600; background: #f5f6f8; }
            .legal-letter .letter-from { font-size: 0.88rem; line-height: 1.65; margin-bottom: 18px; color: #1a1a1a; }
            .legal-letter .letter-to { font-size: 0.88rem; line-height: 1.65; margin-bottom: 22px; color: #1a1a1a; }
            .legal-letter .letter-re { padding: 10px 14px; background: #f0f3f8; border-left: 4px solid #1E3A5F; margin-bottom: 22px; font-size: 0.92rem; color: #1a1a1a; line-height: 1.55; }
            .legal-letter .letter-salutation { margin-bottom: 18px; font-size: 0.92rem; color: #1a1a1a; }
            .legal-letter p { margin-bottom: 16px; font-size: 0.91rem; line-height: 1.78; text-align: justify; color: #1a1a1a; }
            .legal-letter p.letter-salutation { text-align: left; }
            .legal-letter strong { font-weight: 700; color: #111; }
            .legal-letter .letter-close { margin-top: 32px; font-size: 0.91rem; line-height: 1.9; color: #1a1a1a; }
            .legal-letter .letter-close p { margin-bottom: 0; text-align: left; }
            .legal-letter .letter-sig-space { height: 48px; }
            .legal-letter .letter-signer { font-weight: 700; font-size: 0.94rem; color: #111; margin-top: 4px; }
          `}</style>
          <div ref={letterContentRef}>
            {isEditing ? (
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                className="legal-letter prose prose-sm max-w-none font-serif leading-relaxed outline-none min-h-[400px] focus:outline-none"
                style={{ color: "#1a1a1a" }}
                dangerouslySetInnerHTML={{ __html: editedHtml }}
                data-testid="editor-letter-content"
              />
            ) : (
              <div
                className="legal-letter prose prose-sm max-w-none font-serif leading-relaxed"
                style={{ color: "#1a1a1a" }}
                dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
                data-testid="text-letter-content"
              />
            )}

          {isSigned && signature && (
            <div className="mt-8 pt-4 border-t border-gray-300">
              <p className="text-xs text-gray-500 mb-2">Electronically signed:</p>
              <img
                src={signature.signatureBase64}
                alt="Signature"
                className="max-h-20 max-w-[200px]"
                data-testid="img-signature"
              />
              <p className="text-xs text-gray-500 mt-1">
                Signed on {new Date(signature.signedAt).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </p>
            </div>
          )}

          <div className="mt-8 pt-4 border-t border-gray-200" style={{ fontSize: "9px", color: "#888" }}>
            <p>
              <strong>Disclaimer:</strong> This letter was generated by TenantAdvocate, an AI-powered legal technology platform.
              This platform is not a law firm and does not provide legal advice. This letter is a tool for tenant self-representation.
              The information contained herein is based on publicly available statutes and the facts provided by the user.
              Consult a licensed attorney for complex legal matters or if you have questions about your specific situation.
            </p>
          </div>
          </div>
        </Card>

        {isSigned && (
          <Card className="p-5 sm:p-6 print:hidden">
            <div className="flex items-center gap-2 mb-4">
              <Mail className="h-5 w-5 text-[#2E5FAA]" />
              <h3 className="font-serif text-lg font-bold text-foreground">Next Steps</h3>
            </div>
            <div className="space-y-3">
              {[
                { step: "1", title: "Print Your Letter", desc: "Print the letter on standard white paper using the Print button above." },
                { step: "2", title: "Send via Certified Mail", desc: "Send the letter via USPS Certified Mail with Return Receipt Requested. This creates a legal record proving your landlord received the letter." },
                { step: "3", title: "Keep Copies", desc: "Keep a copy of the letter, the certified mail receipt, and the return receipt card for your records." },
                { step: "4", title: "Wait 10 Business Days", desc: "Allow your landlord 10 business days to respond. If they don't, you can file in Small Claims Court." },
              ].map((item) => (
                <div key={item.step} className="flex gap-3 p-3 rounded-md bg-card border">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[#2E5FAA]/10 flex items-center justify-center">
                    <span className="text-[#2E5FAA] font-bold text-xs">{item.step}</span>
                  </div>
                  <div>
                    <p className="font-medium text-sm text-foreground">{item.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {!isSigned && (
          <div ref={signatureSectionRef} className="space-y-4" id="signature-section">
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="h-5 w-5 text-[#2E5FAA]" />
                <h3 className="font-serif text-lg font-bold text-foreground">Sign Your Letter</h3>
              </div>

              <div className="mb-4">
                <div
                  className={`relative border-2 rounded-md bg-white ${
                    sigError ? "border-red-500" : "border-input"
                  }`}
                  style={{ touchAction: "none" }}
                >
                  <canvas
                    ref={canvasRef}
                    className="w-full cursor-crosshair"
                    style={{ height: "200px", display: "block" }}
                    onMouseDown={startDraw}
                    onMouseMove={draw}
                    onMouseUp={stopDraw}
                    onMouseLeave={stopDraw}
                    onTouchStart={startDraw}
                    onTouchMove={draw}
                    onTouchEnd={stopDraw}
                    data-testid="canvas-signature"
                  />
                  <div className="absolute bottom-3 left-4 right-4 border-t border-gray-300 pointer-events-none" />
                  <span className="absolute bottom-1 left-4 text-[10px] text-gray-400 pointer-events-none">
                    Sign above the line
                  </span>
                </div>
                {sigError && (
                  <p className="text-sm text-destructive mt-2" data-testid="text-sig-error">{sigError}</p>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearSignature}
                  className="mt-2"
                  data-testid="button-clear-signature"
                >
                  <Eraser className="mr-1 h-3 w-3" />
                  Clear
                </Button>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-md bg-card border mb-4">
                <Checkbox
                  id="certify"
                  checked={certified}
                  onCheckedChange={(checked) => setCertified(checked === true)}
                  data-testid="checkbox-certify"
                />
                <label
                  htmlFor="certify"
                  className="text-sm text-foreground leading-relaxed cursor-pointer"
                >
                  I certify that all information above is accurate and true to the best of my knowledge. I understand this letter will be sent to my landlord as a formal legal demand.
                </label>
              </div>

              <Button
                size="lg"
                onClick={handleSend}
                disabled={submitSignature.isPending}
                data-testid="button-submit-signature"
                className="w-full bg-[#C9A84C] text-white border-[#b8963f] text-base"
              >
                {submitSignature.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Sign & Finalize Letter
                  </>
                )}
              </Button>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
