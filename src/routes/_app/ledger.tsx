import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, FileText, Share2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useShop } from "@/hooks/useShop";
import { toast } from "sonner";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

export const Route = createFileRoute("/_app/ledger")({ component: Ledger });

type LedgerEntry = Tables<"ledger_entries">;
type PartyLedger = {
  party: string;
  openingBalance: number;
  entries: LedgerEntry[];
  debit: number;
  credit: number;
  balance: number;
};

function Ledger() {
  const { data: shop } = useShop();
  const defaultPeriod = useMemo(() => getDefaultPeriod(), []);
  const [fromDate, setFromDate] = useState(defaultPeriod.from);
  const [toDate, setToDate] = useState(defaultPeriod.to);
  const [selected, setSelected] = useState<PartyLedger | null>(null);

  const { data: rows = [] } = useQuery({
    queryKey: ["ledger", shop?.shop_id],
    enabled: !!shop?.shop_id,
    queryFn: async () => {
      const { data, error } = await supabase.from("ledger_entries").select("*").order("date", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const ledgers = useMemo(() => {
    const groups = new Map<string, LedgerEntry[]>();
    rows.forEach((entry) => {
      const party = entry.party || "Unknown";
      groups.set(party, [...(groups.get(party) ?? []), entry]);
    });

    return Array.from(groups.entries())
      .map(([party, entries]) => {
        const openingEntries = entries.filter((entry) => fromDate && entry.date < fromDate);
        const periodEntries = entries.filter((entry) => isWithinPeriod(entry.date, fromDate, toDate));
        const openingBalance = ledgerBalance(openingEntries);
        const debit = periodEntries.filter((entry) => entry.type === "Debit").reduce((sum, entry) => sum + Number(entry.amount), 0);
        const credit = periodEntries.filter((entry) => entry.type === "Credit").reduce((sum, entry) => sum + Number(entry.amount), 0);
        return { party, openingBalance, entries: periodEntries, debit, credit, balance: openingBalance + debit - credit };
      })
      .filter((ledger) => ledger.entries.length > 0 || ledger.openingBalance !== 0)
      .sort((a, b) => a.party.localeCompare(b.party));
  }, [fromDate, rows, toDate]);

  const totalDebit = ledgers.reduce((sum, ledger) => sum + ledger.debit, 0);
  const totalCredit = ledgers.reduce((sum, ledger) => sum + ledger.credit, 0);
  const totalBalance = ledgers.reduce((sum, ledger) => sum + ledger.balance, 0);

  const handleDownload = async (ledger: PartyLedger) => {
    const pdf = createLedgerPdf(ledger, fromDate, toDate);
    const fileName = fileNameFor(ledger);

    if (Capacitor.isNativePlatform()) {
      await writeNativePdf(pdf, fileName, Directory.Documents);
      toast.success("PDF saved on device");
      return;
    }

    pdf.save(fileNameFor(ledger));
  };

  const handleShare = async (ledger: PartyLedger) => {
    const pdf = createLedgerPdf(ledger, fromDate, toDate);
    const fileName = fileNameFor(ledger);

    if (Capacitor.isNativePlatform()) {
      const saved = await writeNativePdf(pdf, fileName, Directory.Cache);
      await Share.share({ title: `${ledger.party} Ledger`, text: `${ledger.party} ledger report`, url: saved.uri, dialogTitle: "Share ledger PDF" });
      return;
    }

    const file = new File([pdf.output("blob")], fileNameFor(ledger), { type: "application/pdf" });
    const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };

    if (navigator.share && (!nav.canShare || nav.canShare({ files: [file] }))) {
      await navigator.share({ title: `${ledger.party} Ledger`, text: `${ledger.party} ledger report`, files: [file] });
      return;
    }

    pdf.save(fileNameFor(ledger));
    toast.info("PDF downloaded. Use your device share option to send it on WhatsApp.");
  };

  return (
    <div>
      <PageHeader title="Ledger / Accounts" description="Auto party-wise customer ledger reports" />

      <Card className="p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-4 items-end">
          <div className="space-y-2">
            <Label htmlFor="ledger-from">From date</Label>
            <Input id="ledger-from" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ledger-to">To date</Label>
            <Input id="ledger-to" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
          </div>
          <Button variant="outline" onClick={() => {
            const next = getDefaultPeriod();
            setFromDate(next.from);
            setToDate(next.to);
          }}>Last 30 Days</Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card className="p-5"><p className="text-sm text-muted-foreground">Total Debits</p><p className="text-2xl font-bold text-success mt-1">Rs.{totalDebit.toLocaleString()}</p></Card>
        <Card className="p-5"><p className="text-sm text-muted-foreground">Total Credits</p><p className="text-2xl font-bold text-destructive mt-1">Rs.{totalCredit.toLocaleString()}</p></Card>
        <Card className="p-5"><p className="text-sm text-muted-foreground">Closing Balance</p><p className="text-2xl font-bold mt-1">Rs.{totalBalance.toLocaleString()}</p></Card>
      </div>

      <Card>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Party</TableHead><TableHead className="text-right">Entries</TableHead>
            <TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Credit</TableHead>
            <TableHead className="text-right">Balance</TableHead><TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {ledgers.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No auto ledger entries yet</TableCell></TableRow>}
            {ledgers.map((ledger) => (
              <TableRow key={ledger.party}>
                <TableCell className="font-medium">{ledger.party}</TableCell>
                <TableCell className="text-right">{ledger.entries.length}</TableCell>
                <TableCell className="text-right text-success font-medium">Rs.{ledger.debit.toLocaleString()}</TableCell>
                <TableCell className="text-right text-destructive font-medium">Rs.{ledger.credit.toLocaleString()}</TableCell>
                <TableCell className="text-right font-semibold">Rs.{ledger.balance.toLocaleString()}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => setSelected(ledger)}><FileText className="h-4 w-4 mr-1" />Report</Button>
                    <Button size="icon" variant="ghost" onClick={() => handleDownload(ledger)}><Download className="h-4 w-4" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-5xl">
          {selected && (
            <>
              <DialogHeader><DialogTitle>Ledger Report - {selected.party}</DialogTitle></DialogHeader>
              <div className="space-y-5">
                <div className="text-center">
                  <h2 className="text-xl font-semibold">Financial Ledger</h2>
                  <p className="text-muted-foreground">{selected.party}</p>
                  <p className="text-sm">Period: {periodText(fromDate, toDate)}</p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Summary label="Opening Balance" value={selected.openingBalance} />
                  <Summary label="Total Debits" value={selected.debit} className="text-success" />
                  <Summary label="Total Credits" value={selected.credit} className="text-destructive" />
                  <Summary label="Closing Balance" value={selected.balance} />
                </div>
                <div className="max-h-[55vh] overflow-auto rounded-md border">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Description</TableHead>
                      <TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Credit</TableHead><TableHead className="text-right">Balance</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      <TableRow className="bg-muted/50">
                        <TableCell>{fromDate || selected.entries[0]?.date || "-"}</TableCell><TableCell>Opening</TableCell><TableCell>Opening Balance</TableCell>
                        <TableCell></TableCell><TableCell></TableCell><TableCell className="text-right font-semibold">{money(selected.openingBalance)}</TableCell>
                      </TableRow>
                      {runningRows(selected.entries, selected.openingBalance).map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>{row.date}</TableCell>
                          <TableCell><Badge variant="outline">{row.type}</Badge></TableCell>
                          <TableCell>{row.note}</TableCell>
                          <TableCell className="text-right text-success font-medium">{row.debit || ""}</TableCell>
                          <TableCell className="text-right text-destructive font-medium">{row.credit || ""}</TableCell>
                          <TableCell className="text-right font-semibold">{row.balance}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/50 font-semibold">
                        <TableCell>{toDate || selected.entries.at(-1)?.date || "-"}</TableCell><TableCell>Closing</TableCell><TableCell>Closing Balance</TableCell>
                        <TableCell></TableCell><TableCell></TableCell><TableCell className="text-right">{money(selected.balance)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => handleShare(selected)}><Share2 className="h-4 w-4 mr-2" />Share PDF</Button>
                <Button onClick={() => handleDownload(selected)}><Download className="h-4 w-4 mr-2" />Download PDF</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Summary({ label, value, className = "" }: { label: string; value: number; className?: string }) {
  return <div className="text-center rounded-md bg-muted p-3"><p className="text-sm text-muted-foreground">{label}</p><p className={`text-lg font-bold ${className}`}>Rs.{value.toLocaleString()}</p></div>;
}

function runningRows(entries: LedgerEntry[], openingBalance = 0) {
  let balance = openingBalance;
  return entries.map((entry) => {
    const amount = Number(entry.amount);
    const debit = entry.type === "Debit" ? amount : 0;
    const credit = entry.type === "Credit" ? amount : 0;
    balance += debit - credit;
    return {
      id: entry.id,
      date: entry.date,
      type: entry.type,
      note: entry.note ?? "-",
      debit: debit ? money(debit) : "",
      credit: credit ? money(credit) : "",
      balance: money(balance),
    };
  });
}

function createLedgerPdf(ledger: PartyLedger, fromDate: string, toDate: string) {
  const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const width = pdf.internal.pageSize.getWidth();
  pdf.setFontSize(18);
  pdf.text("Financial Ledger", width / 2, 48, { align: "center" });
  pdf.setFontSize(12);
  pdf.text(ledger.party, width / 2, 68, { align: "center" });
  pdf.text(`Period: ${periodText(fromDate, toDate)}`, width / 2, 86, { align: "center" });

  autoTable(pdf, {
    startY: 112,
    head: [["Opening Balance", "Total Debits", "Total Credits", "Closing Balance"]],
    body: [[money(ledger.openingBalance), money(ledger.debit), money(ledger.credit), money(ledger.balance)]],
    theme: "grid",
    styles: { halign: "center", fontSize: 11 },
  });

  autoTable(pdf, {
    startY: 178,
    head: [["Date", "Type", "Description", "Receipt No", "Debit", "Credit", "Balance"]],
    body: [
      [fromDate || ledger.entries[0]?.date || "-", "Opening", "Opening Balance", "-", "", "", money(ledger.openingBalance)],
      ...runningRows(ledger.entries, ledger.openingBalance).map((row) => [row.date, row.type, row.note, receiptFromNote(row.note), row.debit, row.credit, row.balance]),
      [toDate || ledger.entries.at(-1)?.date || "-", "Closing", "Closing Balance", "-", "", "", money(ledger.balance)],
    ],
    theme: "grid",
    headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42] },
    styles: { fontSize: 10, cellPadding: 8 },
  });

  return pdf;
}

function writeNativePdf(pdf: jsPDF, fileName: string, directory: Directory) {
  return Filesystem.writeFile({
    path: fileName,
    data: pdf.output("datauristring").split(",")[1] ?? "",
    directory,
    recursive: true,
  });
}

function fileNameFor(ledger: PartyLedger) {
  return `${ledger.party.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase()}-ledger.pdf`;
}

function periodText(fromDate: string, toDate: string) {
  if (fromDate && toDate) return `${fromDate} to ${toDate}`;
  if (fromDate) return `From ${fromDate}`;
  if (toDate) return `Up to ${toDate}`;
  return "All dates";
}

function isWithinPeriod(date: string, fromDate: string, toDate: string) {
  if (fromDate && date < fromDate) return false;
  if (toDate && date > toDate) return false;
  return true;
}

function ledgerBalance(entries: LedgerEntry[]) {
  return entries.reduce((sum, entry) => {
    const amount = Number(entry.amount);
    return entry.type === "Debit" ? sum + amount : sum - amount;
  }, 0);
}

function getDefaultPeriod() {
  const today = new Date();
  const from = new Date(today);
  from.setDate(today.getDate() - 30);
  return { from: toDateInputValue(from), to: toDateInputValue(today) };
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function receiptFromNote(note: string) {
  const match = note.match(/(INV|RCPT|PUR)-[A-Za-z0-9-]+/i);
  return match?.[0] ?? "-";
}

function money(value: number) {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
