import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import FamilyReport from '../src/FamilyReport';
const claim={text:'Getting started took three verbal prompts.',observation_refs:['O1']};
const draft={session_id:'synthetic-session',case_id:'SYN-FAMILY',duration_minutes:40,status:'draft',stale:false,evidence:[{alias:'O1',text:'Required three verbal prompts to begin the block-fitting activity',observation_id:'synthetic-observation',source_excerpt:'Required three verbal prompts to begin the block-fitting activity',reviewer_id:'synthetic-reviewer',audit_event_id:'synthetic-audit'}],report:{summary:'Synthetic family session draft.',participation:[claim],strengths:[],support:[claim],home_suggestions:[{activity:'pause',text:'If comfortable, consider a pause; ask your therapist.',observation_refs:['O1']}],longitudinal_limitations:'One session cannot establish progress.'}};
const json=(data:unknown)=>Promise.resolve(new Response(JSON.stringify(data)));
async function flush(){await act(async()=>{await Promise.resolve();});}
function setup(){const fetch=vi.fn(()=>json(draft));vi.stubGlobal('fetch',fetch);const view=render(<FamilyReport apiBase="/api" sessionId="synthetic-session"/>);fireEvent.change(screen.getByLabelText('Family-report operator credential'),{target:{value:'synthetic-test-operator-secret'}});fireEvent.change(screen.getByLabelText('Registered synthetic report reviewer'),{target:{value:'synthetic-reviewer'}});fireEvent.click(screen.getByLabelText(/I confirm this session/));return{fetch,...view};}
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('never generates automatically and collapses double clicks to one POST',async()=>{
 const{fetch}=setup();expect(fetch).not.toHaveBeenCalled();let resolve:(value:Response)=>void=()=>{};fetch.mockImplementation(()=>new Promise(r=>{resolve=r;}));
 const button=screen.getByRole('button',{name:'Generate Family Report'});fireEvent.click(button);fireEvent.click(button);expect(fetch).toHaveBeenCalledTimes(1);
 expect(JSON.parse(fetch.mock.calls[0][1]?.body as string)).toEqual({reviewer_id:'synthetic-reviewer',synthetic_confirmed:true});
 await act(async()=>resolve(new Response(JSON.stringify(draft))));expect(screen.getByText('Draft')).toBeTruthy();expect((button as HTMLButtonElement).disabled).toBe(true);
});
it('shows source, draft warnings and explicit review controls; approval never triggers generation',async()=>{
 const{fetch}=setup();fireEvent.click(screen.getByRole('button',{name:'Generate Family Report'}));await flush();
 expect(screen.getByText(/pending therapist review/)).toBeTruthy();expect(screen.getByText(/One session cannot establish progress/)).toBeTruthy();
 fireEvent.click(screen.getAllByText('Evidence O1')[0]);expect((document.querySelector('.family-paper details') as HTMLDetailsElement).open).toBe(true);expect(screen.getByText(/Audit synthetic-audit/)).toBeTruthy();
 const approve=screen.getByRole('button',{name:'Approve synthetic family draft'});expect((approve as HTMLButtonElement).disabled).toBe(true);
 fireEvent.click(screen.getByLabelText(/I reviewed every statement/));fireEvent.change(screen.getByLabelText('Report decision note'),{target:{value:'Checked each source and optional suggestion.'}});
 fetch.mockImplementation(()=>json({...draft,status:'approved',reviewed_by:'synthetic-reviewer'}));fireEvent.click(approve);await flush();expect(screen.getByText('Approved')).toBeTruthy();expect(fetch.mock.calls[1][0]).toContain('/review');expect(screen.queryByRole('button',{name:'Approve synthetic family draft'})).toBeNull();
});
it('loads stored/failed results without provider retry and clears on session change',async()=>{
 const view=setup();view.fetch.mockImplementation(()=>json({...draft,status:'failed',report:null}));fireEvent.click(screen.getByRole('button',{name:'Load saved family report'}));await flush();expect(screen.getByRole('alert').textContent).toContain('No automatic retry');expect(view.fetch.mock.calls[0][1]?.method).toBe('GET');
 view.rerender(<FamilyReport apiBase="/api" sessionId="another-synthetic-session"/>);expect(screen.queryByText('failed')).toBeNull();expect(view.fetch).toHaveBeenCalledTimes(1);
});
it('keeps failures unapproved and stale evidence non-approvable',async()=>{
 const{fetch}=setup();fetch.mockImplementation(()=>Promise.resolve(new Response('Unavailable',{status:503})));fireEvent.click(screen.getByRole('button',{name:'Generate Family Report'}));await flush();expect(screen.getByRole('alert').textContent).toContain('503');expect(screen.queryByText('Approved')).toBeNull();
 fetch.mockImplementation(()=>json({...draft,stale:true}));fireEvent.click(screen.getByRole('button',{name:'Load saved family report'}));await flush();expect(screen.getByText(/Evidence changed/)).toBeTruthy();expect(screen.queryByRole('button',{name:'Approve synthetic family draft'})).toBeNull();
});
it('ignores a late response from a different session',async()=>{
 const view=setup();let resolve:(value:Response)=>void=()=>{};view.fetch.mockImplementation(()=>new Promise(r=>{resolve=r;}));fireEvent.click(screen.getByRole('button',{name:'Generate Family Report'}));view.rerender(<FamilyReport apiBase="/api" sessionId="new-session"/>);await act(async()=>resolve(new Response(JSON.stringify(draft))));expect(screen.queryByText('Participation, together')).toBeNull();
});
it('rejects without approving or issuing another generation call',async()=>{
 const{fetch}=setup();fireEvent.click(screen.getByRole('button',{name:'Generate Family Report'}));await flush();fireEvent.click(screen.getByLabelText(/I reviewed every statement/));fireEvent.change(screen.getByLabelText('Report decision note'),{target:{value:'Declined these optional ideas.'}});fetch.mockImplementation(()=>json({...draft,status:'rejected'}));fireEvent.click(screen.getByRole('button',{name:'Reject synthetic family draft'}));await flush();expect(screen.getByText('rejected')).toBeTruthy();expect(JSON.parse(fetch.mock.calls[1][1]?.body as string).decision).toBe('reject');expect(screen.queryByText('Approved')).toBeNull();
});
it('rejects malformed or mismatched API responses rather than displaying an approved report',async()=>{
 const{fetch}=setup();fetch.mockImplementation(()=>json({...draft,session_id:'different-session',status:'approved'}));fireEvent.click(screen.getByRole('button',{name:'Load saved family report'}));await flush();expect(screen.getByRole('alert').textContent).toContain('Unexpected family-report response');expect(screen.queryByText('Participation, together')).toBeNull();
 fetch.mockImplementation(()=>json({...draft,report:{summary:'invalid'}}));fireEvent.click(screen.getByRole('button',{name:'Load saved family report'}));await flush();expect(screen.getByRole('alert').textContent).toContain('Unexpected family-report response');
});
